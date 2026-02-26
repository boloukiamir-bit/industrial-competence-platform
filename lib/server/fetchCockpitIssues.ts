/**
 * Real cockpit issues from v_cockpit_station_summary (station/shift health).
 * execution_decisions only annotate (resolved, actions); they do NOT create issues.
 *
 * Date column: shift_date (from view; sourced from roster.plan_date).
 * Throws if column is missing.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { stationShiftTargetId } from "@/lib/shared/decisionIds";
import { normalizeShiftCode } from "@/lib/server/normalizeShiftCode";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** v_cockpit_station_summary date column for shift day. Required. */
const DATE_COLUMN = "shift_date";

export type CockpitIssueRaw = {
  org_id: string;
  site_id: string | null;
  shift_date: string;
  shift_code: string;
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  area: string | null;
  no_go_count: number;
  warning_count: number;
  go_count: number;
  roster_headcount: number;
  station_shift_status: "NO_GO" | "WARNING" | "GO" | "UNSTAFFED" | "ILLEGAL";
  severity_rank: number;
  leader_name: string | null;
};

export type CockpitIssue = {
  issue_id: string;
  type: string;
  severity: "BLOCKING" | "WARNING";
  issue_type: "NO_GO" | "WARNING" | "GO" | "UNSTAFFED" | "ILLEGAL";
  line: string;
  shift_code: string;
  date: string;
  root_cause: unknown;
  recommended_action: string;
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  area: string | null;
  no_go_count: number;
  warning_count: number;
  go_count: number;
  roster_headcount: number;
  resolved?: boolean;
  decision_actions?: string[];
  decision_created_at?: string | null;
  decision_type?: string | null;
  /** Set only for issue_type === "UNSTAFFED" (SHIFT or GLOBAL). */
  unstaffed_reason?: "NO_ROSTER_ROW" | "HAS_ROSTER_ROW";
};

export type FetchCockpitIssuesParams = {
  org_id: string;
  site_id: string | null;
  date: string;
  /** When empty/omitted, no shift filter is applied (organization-wide for the date). */
  shift_code?: string;
  line?: string;
  include_go?: boolean;
  show_resolved?: boolean;
  debug?: boolean;
};

export type FetchCockpitIssuesDebugInfo = {
  org_id: string;
  site_id: string | null;
  site_filter_mode: "none" | "orNull";
  date: string;
  shift_code: string | null;
  date_format_valid: boolean;
  raw_count_before_status: number;
  raw_count_after_status: number;
  /** Present when debug=1: UNSTAFFED classification counts. */
  unstaffed_total?: number;
  unstaffed_no_roster_row?: number;
  unstaffed_has_roster_row?: number;
};

function toIssueId(
  orgId: string,
  siteId: string | null,
  date: string,
  shiftCode: string,
  line: string,
  stationId: string,
  issueType: string
): string {
  const key = `ci:${orgId}:${siteId ?? ""}:${date}:${shiftCode}:${line}:${stationId}:${issueType}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/** Normalize shift code for roster lookups (S1→1, S2→2; Day/Evening/Night unchanged). */
function normalizeRosterShiftCode(shift_code: string): string {
  return normalizeShiftCode(shift_code);
}

/** Validate date is YYYY-MM-DD for shift_date column (text in view). */
function toShiftDateString(input: string): string | null {
  const s = input?.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const n = (v: string) => parseInt(v, 10);
  if (n(mo) < 1 || n(mo) > 12 || n(d) < 1 || n(d) > 31) return null;
  return `${y}-${mo}-${d}`;
}

/**
 * Global cockpit issues: organization-wide view with no shift selection.
 * Deterministic rule: use the latest shift_date present in v_cockpit_station_summary
 * for the org/site, then return all active (NO_GO, WARNING, UNSTAFFED, ILLEGAL) rows
 * for that date across all shifts. Does NOT apply execution_decisions (station_shift)
 * resolution — all issues are shown as active; "Record decision" is only available in SHIFT mode.
 */
export type FetchCockpitIssuesGlobalParams = {
  org_id: string;
  site_id: string | null;
  line?: string;
  include_go?: boolean;
  show_resolved?: boolean;
  debug?: boolean;
};

export type FetchCockpitIssuesGlobalDebugInfo = {
  org_id: string;
  site_id: string | null;
  latest_date: string | null;
  raw_count: number;
  /** Shift code used for roster lookup (most frequent on latest_date; tie = lexicographically smallest). */
  global_roster_shift_code_used?: string;
  unstaffed_total?: number;
  unstaffed_no_roster_row?: number;
  unstaffed_has_roster_row?: number;
};

export async function fetchCockpitIssuesGlobal(
  params: FetchCockpitIssuesGlobalParams
): Promise<{ issues: CockpitIssue[]; debug?: FetchCockpitIssuesGlobalDebugInfo }> {
  const { org_id, site_id, line, include_go = false, show_resolved = false, debug = false } = params;

  // Deterministic: latest shift_date in view for this org/site
  let dateQuery = supabaseAdmin
    .from("v_cockpit_station_summary")
    .select("shift_date")
    .eq("org_id", org_id)
    .order(DATE_COLUMN, { ascending: false })
    .limit(1);
  if (site_id) {
    dateQuery = dateQuery.or(`site_id.is.null,site_id.eq.${site_id}`);
  }
  const { data: dateRows, error: dateError } = await dateQuery;
  if (dateError || !dateRows?.length) {
    if (debug) {
      return {
        issues: [],
        debug: { org_id, site_id, latest_date: null, raw_count: 0 },
      };
    }
    return { issues: [] };
  }
  const latestDate = (dateRows[0] as { shift_date: string }).shift_date;
  if (!latestDate || !toShiftDateString(latestDate)) {
    return { issues: [] };
  }

  // All rows for that date (no shift filter); no execution_decisions — show all active issues
  let query = supabaseAdmin
    .from("v_cockpit_station_summary")
    .select("*")
    .eq("org_id", org_id)
    .eq(DATE_COLUMN, latestDate);
  if (site_id) {
    query = query.or(`site_id.is.null,site_id.eq.${site_id}`);
  }
  if (line && line !== "all") {
    query = query.eq("area", line);
  }
  const { data: rows, error } = await query
    .order("severity_rank", { ascending: true })
    .order("area", { ascending: true, nullsFirst: false })
    .order("station_code", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[fetchCockpitIssuesGlobal] error:", error);
    return { issues: [] };
  }

  const allRows = (rows || []) as CockpitIssueRaw[];
  const statusMatch = (r: CockpitIssueRaw) =>
    r.station_shift_status === "NO_GO" ||
    r.station_shift_status === "WARNING" ||
    r.station_shift_status === "UNSTAFFED" ||
    r.station_shift_status === "ILLEGAL" ||
    (r.no_go_count ?? 0) > 0 ||
    (r.warning_count ?? 0) > 0;
  const rawList = include_go ? allRows : allRows.filter(statusMatch);

  // Deterministic: most frequent shift_code for this date; tie = lexicographically smallest
  const shiftCounts = new Map<string, number>();
  for (const r of allRows) {
    const sc = (r.shift_code ?? "").trim();
    if (sc) shiftCounts.set(sc, (shiftCounts.get(sc) ?? 0) + 1);
  }
  let rosterShiftCode = "";
  let maxCount = 0;
  for (const [sc, count] of shiftCounts) {
    if (count > maxCount || (count === maxCount && (rosterShiftCode === "" || sc < rosterShiftCode))) {
      maxCount = count;
      rosterShiftCode = sc;
    }
  }

  let rosterStationCodes = new Set<string>();
  if (rosterShiftCode) {
    const normalizedShift = normalizeRosterShiftCode(rosterShiftCode);
    const { data: rosterRows } = await supabaseAdmin
      .from("stg_roster_v1")
      .select("station_code")
      .eq("shift_code", normalizedShift);
    for (const row of rosterRows ?? []) {
      const c = (row as { station_code: string | null }).station_code;
      if (c != null && String(c).trim() !== "") rosterStationCodes.add(String(c).trim());
    }
  }

  const BLOCKING_STATUSES = new Set<string>(["NO_GO", "UNSTAFFED", "ILLEGAL"]);
  const issues: CockpitIssue[] = [];
  for (const r of rawList) {
    const severity = BLOCKING_STATUSES.has(r.station_shift_status) ? "BLOCKING" : "WARNING";
    const lineVal = r.area ?? "";
    const issueType = r.station_shift_status;
    const shiftCode = r.shift_code ?? "";

    const issueId = toIssueId(org_id, site_id, latestDate, shiftCode, lineVal, r.station_id, issueType);

    let primaryLabel =
      r.station_shift_status === "NO_GO"
        ? "NO-GO: competence gap"
        : r.station_shift_status === "WARNING"
          ? "WARNING: competence gap"
          : r.station_shift_status === "UNSTAFFED"
            ? "UNSTAFFED: no roster"
            : r.station_shift_status === "ILLEGAL"
              ? "ILLEGAL: roster violation"
              : "WARNING: competence gap";

    let unstaffedReason: "NO_ROSTER_ROW" | "HAS_ROSTER_ROW" | undefined;
    if (issueType === "UNSTAFFED") {
      const hasRosterRow = r.station_code != null && rosterStationCodes.has(r.station_code.trim());
      if (!hasRosterRow) {
        primaryLabel = "UNSTAFFED: no roster row";
        unstaffedReason = "NO_ROSTER_ROW";
      } else {
        unstaffedReason = "HAS_ROSTER_ROW";
      }
    }

    const rootCause = {
      type: "station_issue",
      primary: primaryLabel,
      causes: [] as string[],
      no_go_count: r.no_go_count,
      warning_count: r.warning_count,
    };
    const recommendedAction =
      r.station_shift_status === "NO_GO" || r.station_shift_status === "UNSTAFFED"
        ? "assign"
        : r.station_shift_status === "WARNING"
          ? "swap"
          : r.station_shift_status === "ILLEGAL"
            ? "review"
            : "";

    // GLOBAL: do not apply station_shift resolution; show as active (resolved: false)
    issues.push({
      issue_id: issueId,
      type: "SKILL",
      severity,
      issue_type: issueType,
      line: lineVal,
      shift_code: shiftCode,
      date: r.shift_date ?? latestDate,
      root_cause: rootCause,
      recommended_action: recommendedAction,
      station_id: r.station_id,
      station_code: r.station_code,
      station_name: r.station_name,
      area: r.area,
      no_go_count: r.no_go_count,
      warning_count: r.warning_count,
      go_count: r.go_count,
      roster_headcount: r.roster_headcount,
      resolved: false,
      decision_actions: undefined,
      decision_created_at: undefined,
      decision_type: undefined,
      ...(unstaffedReason !== undefined && { unstaffed_reason: unstaffedReason }),
    });
  }

  const debugInfo: FetchCockpitIssuesGlobalDebugInfo | undefined = debug
    ? {
        org_id,
        site_id,
        latest_date: latestDate,
        raw_count: issues.length,
        global_roster_shift_code_used: rosterShiftCode || undefined,
        unstaffed_total: issues.filter((i) => i.issue_type === "UNSTAFFED").length,
        unstaffed_no_roster_row: issues.filter(
          (i) => i.issue_type === "UNSTAFFED" && i.unstaffed_reason === "NO_ROSTER_ROW"
        ).length,
        unstaffed_has_roster_row: issues.filter(
          (i) => i.issue_type === "UNSTAFFED" && i.unstaffed_reason === "HAS_ROSTER_ROW"
        ).length,
      }
    : undefined;

  return debug ? { issues, debug: debugInfo } : { issues };
}

export async function fetchCockpitIssues(
  params: FetchCockpitIssuesParams
): Promise<{ issues: CockpitIssue[]; debug?: FetchCockpitIssuesDebugInfo }> {
  const { org_id, site_id, date, shift_code, line, include_go = false, show_resolved = false, debug = false } = params;

  const dateString = toShiftDateString(date) ?? date;
  const dateFormatValid = toShiftDateString(date) !== null;

  // View stores shift_code as textual Day|Evening|Night (from pl_assignment_segments.shift_type).
  // When shift_code is empty/omitted, do not filter by shift (organization-wide for the date).
  const shiftFilter = (shift_code ?? "").trim() || null;

  // Filter by shift_date (YYYY-MM-DD text in view); optionally by shift_code.
  let query = supabaseAdmin
    .from("v_cockpit_station_summary")
    .select("*")
    .eq("org_id", org_id)
    .eq(DATE_COLUMN, dateString);
  if (shiftFilter) {
    query = query.eq("shift_code", shiftFilter);
  }

  let siteFilterMode: "none" | "orNull" = "none";
  if (site_id) {
    // Include both org-wide (site_id null) and site-specific rows.
    query = query.or(`site_id.is.null,site_id.eq.${site_id}`);
    siteFilterMode = "orNull";
  }
  // When site_id is null: do not apply any site_id filter (org-wide), so site-scoped rows are included.

  if (line && line !== "all") {
    query = query.eq("area", line);
  }

  // Do NOT filter by station_shift_status in query - fetch all matching rows,
  // then filter in memory for status + count debug.
  const { data: rows, error } = await query
    .order("severity_rank", { ascending: true })
    .order("area", { ascending: true, nullsFirst: false })
    .order("station_code", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[fetchCockpitIssues] v_cockpit_station_summary error:", error);
    const errMsg = String(error.message ?? error);
    if (
      errMsg.includes("column") ||
      errMsg.includes(DATE_COLUMN) ||
      /relation.*does not exist|undefined column/i.test(errMsg)
    ) {
      throw new Error(
        `v_cockpit_station_summary: expected date column "${DATE_COLUMN}" is missing or invalid. ` +
          `Run migration 20260208100000. Error: ${errMsg}`
      );
    }
    return { issues: [] };
  }

  const allRows = (rows || []) as CockpitIssueRaw[];
  const rawCountBeforeStatus = allRows.length;

  // Include rows that are blocking (NO_GO, UNSTAFFED, ILLEGAL), warning (WARNING), or have counts; exclude GO unless include_go.
  const statusMatch = (r: CockpitIssueRaw) =>
    r.station_shift_status === "NO_GO" ||
    r.station_shift_status === "WARNING" ||
    r.station_shift_status === "UNSTAFFED" ||
    r.station_shift_status === "ILLEGAL" ||
    (r.no_go_count ?? 0) > 0 ||
    (r.warning_count ?? 0) > 0;

  const rawList = include_go ? allRows : allRows.filter(statusMatch);
  const rawCountAfterStatus = rawList.length;

  const debugInfo: FetchCockpitIssuesDebugInfo | undefined = debug
    ? {
        org_id,
        site_id,
        site_filter_mode: siteFilterMode,
        date: dateString,
        shift_code: shiftFilter,
        date_format_valid: dateFormatValid,
        raw_count_before_status: rawCountBeforeStatus,
        raw_count_after_status: rawCountAfterStatus,
      }
    : undefined;

  // SHIFT mode only: build set of station_codes that have a roster row for this shift (deterministic, no org/site/date in stg_roster_v1)
  let rosterStationCodes = new Set<string>();
  if (shiftFilter) {
    const normalizedShift = normalizeRosterShiftCode(shiftFilter);
    const { data: rosterRows } = await supabaseAdmin
      .from("stg_roster_v1")
      .select("station_code")
      .eq("shift_code", normalizedShift);
    for (const row of rosterRows ?? []) {
      const c = (row as { station_code: string | null }).station_code;
      if (c != null && String(c).trim() !== "") rosterStationCodes.add(String(c).trim());
    }
  }

  // Fetch execution_decisions (station_shift) for resolved/actions annotation (use row shift when no filter)
  const targetIds = rawList.map((r) =>
    stationShiftTargetId(org_id, site_id, dateString, shiftFilter ?? r.shift_code ?? "", r.station_id, r.station_shift_status)
  );
  const targetIdSet = new Set(targetIds);

  let decisionsMap = new Map<
    string,
    { resolved: boolean; actions: string[]; created_at: string | null; decision_type: string | null }
  >();

  const RESOLVED_CHOSEN = new Set(["acknowledged", "resolved", "plan_training", "swap", "escalate"]);

  if (targetIdSet.size > 0) {
    const { data: edRows } = await supabaseAdmin
      .from("execution_decisions")
      .select("target_id, status, actions, created_at, decision_type")
      .eq("org_id", org_id)
      .eq("target_type", "station_shift")
      .eq("status", "active")
      .in("target_id", [...targetIdSet]);

    for (const ed of edRows || []) {
      const tid = ed.target_id as string;
      const actions: string[] = [];
      const a = ed.actions as Record<string, unknown> | null;
      let chosen: string | null = null;
      if (a) {
        chosen = (a.chosen ?? a.selected_action) as string | null;
        if (typeof chosen === "string" && chosen) actions.push(chosen);
        const arr = Array.isArray(a.selected) ? a.selected : Array.isArray(a.recommended) ? a.recommended : [];
        for (const x of arr) if (typeof x === "string" && x) actions.push(x);
      }
      const dt = ed.decision_type as string | null;
      const resolved =
        dt === "RESOLVED" ||
        RESOLVED_CHOSEN.has((chosen ?? "").toLowerCase()) ||
        (a && typeof (a as { resolved?: boolean }).resolved === "boolean" && (a as { resolved: boolean }).resolved);
      decisionsMap.set(tid, {
        resolved: !!resolved,
        actions: [...new Set(actions)],
        created_at: ed.created_at as string | null,
        decision_type: dt ?? null,
      });
    }
  }

  const BLOCKING_STATUSES = new Set<string>(["NO_GO", "UNSTAFFED", "ILLEGAL"]);
  const issues: CockpitIssue[] = [];
  for (const r of rawList) {
    const severity = BLOCKING_STATUSES.has(r.station_shift_status) ? "BLOCKING" : "WARNING";
    const lineVal = r.area ?? "";
    const issueType = r.station_shift_status;

    const rowShift = shiftFilter ?? r.shift_code ?? "";
    const issueId = toIssueId(org_id, site_id, date, rowShift, lineVal, r.station_id, issueType);

    const targetId = stationShiftTargetId(org_id, site_id, dateString, rowShift, r.station_id, issueType);
    const dec = decisionsMap.get(targetId);

    if (!show_resolved && dec?.resolved) continue;

    let primaryLabel =
      r.station_shift_status === "NO_GO"
        ? "NO-GO: competence gap"
        : r.station_shift_status === "WARNING"
          ? "WARNING: competence gap"
          : r.station_shift_status === "UNSTAFFED"
            ? "UNSTAFFED: no roster"
            : r.station_shift_status === "ILLEGAL"
              ? "ILLEGAL: roster violation"
              : "WARNING: competence gap";

    let unstaffedReason: "NO_ROSTER_ROW" | "HAS_ROSTER_ROW" | undefined;
    if (issueType === "UNSTAFFED" && shiftFilter) {
      const hasRosterRow = r.station_code != null && rosterStationCodes.has(r.station_code.trim());
      if (!hasRosterRow) {
        primaryLabel = "UNSTAFFED: no roster row";
        unstaffedReason = "NO_ROSTER_ROW";
      } else {
        unstaffedReason = "HAS_ROSTER_ROW";
      }
    }

    const rootCause = {
      type: "station_issue",
      primary: primaryLabel,
      causes: [] as string[],
      no_go_count: r.no_go_count,
      warning_count: r.warning_count,
    };

    const recommendedAction =
      r.station_shift_status === "NO_GO" || r.station_shift_status === "UNSTAFFED"
        ? "assign"
        : r.station_shift_status === "WARNING"
          ? "swap"
          : r.station_shift_status === "ILLEGAL"
            ? "review"
            : "";

    issues.push({
      issue_id: issueId,
      type: "SKILL",
      severity,
      issue_type: issueType,
      line: lineVal,
      shift_code: rowShift,
      date: r.shift_date ?? date,
      root_cause: rootCause,
      recommended_action: dec?.actions[0] ?? recommendedAction,
      station_id: r.station_id,
      station_code: r.station_code,
      station_name: r.station_name,
      area: r.area,
      no_go_count: r.no_go_count,
      warning_count: r.warning_count,
      go_count: r.go_count,
      roster_headcount: r.roster_headcount,
      resolved: dec?.resolved ?? false,
      decision_actions: dec?.actions,
      decision_created_at: dec?.created_at,
      decision_type: dec?.decision_type ?? undefined,
      ...(unstaffedReason !== undefined && { unstaffed_reason: unstaffedReason }),
    });
  }

  if (debug && debugInfo) {
    debugInfo.unstaffed_total = issues.filter((i) => i.issue_type === "UNSTAFFED").length;
    debugInfo.unstaffed_no_roster_row = issues.filter(
      (i) => i.issue_type === "UNSTAFFED" && i.unstaffed_reason === "NO_ROSTER_ROW"
    ).length;
    debugInfo.unstaffed_has_roster_row = issues.filter(
      (i) => i.issue_type === "UNSTAFFED" && i.unstaffed_reason === "HAS_ROSTER_ROW"
    ).length;
  }

  return debug ? { issues, debug: debugInfo } : { issues };
}
