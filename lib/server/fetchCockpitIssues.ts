/**
 * Real cockpit issues from v_cockpit_station_summary (station/shift health).
 * execution_decisions only annotate (resolved, actions); they do NOT create issues.
 *
 * Date column: shift_date (from view; sourced from roster.plan_date).
 * Throws if column is missing.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { normalizeShift } from "@/lib/shift";
import { stationShiftTargetId } from "@/lib/shared/decisionIds";

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
  station_shift_status: "NO_GO" | "WARNING" | "GO";
  severity_rank: number;
  leader_name: string | null;
};

export type CockpitIssue = {
  issue_id: string;
  type: string;
  severity: "BLOCKING" | "WARNING";
  issue_type: "NO_GO" | "WARNING" | "GO";
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
};

export type FetchCockpitIssuesParams = {
  org_id: string;
  site_id: string | null;
  date: string;
  shift_code: string; // normalized to Day|Evening|Night or seeded S1/S2/S3
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
  shift_code: string;
  date_format_valid: boolean;
  raw_count_before_status: number;
  raw_count_after_status: number;
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

export async function fetchCockpitIssues(
  params: FetchCockpitIssuesParams
): Promise<{ issues: CockpitIssue[]; debug?: FetchCockpitIssuesDebugInfo }> {
  const { org_id, site_id, date, shift_code, line, include_go = false, show_resolved = false, debug = false } = params;

  const dateString = toShiftDateString(date) ?? date;
  const dateFormatValid = toShiftDateString(date) !== null;

  // View stores shift_code as textual Day|Evening|Night (from pl_assignment_segments.shift_type)
  // or seeded shift codes (S1/S2/S3). Filter exactly on canonical value.
  const shiftFilter = shift_code;

  // Filter by shift_date (YYYY-MM-DD text in view), shift_code (textual).
  let query = supabaseAdmin
    .from("v_cockpit_station_summary")
    .select("*")
    .eq("org_id", org_id)
    .eq(DATE_COLUMN, dateString)
    .eq("shift_code", shiftFilter);

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

  // Include rows where station_shift_status IN ('NO_GO','WARNING') OR no_go_count>0 OR warning_count>0.
  // (View derives station_shift_status from counts, so these are equivalent; include both for robustness.)
  const statusMatch = (r: CockpitIssueRaw) =>
    r.station_shift_status === "NO_GO" ||
    r.station_shift_status === "WARNING" ||
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

  // Fetch execution_decisions (station_shift) for resolved/actions annotation
  const targetIds = rawList.map((r) =>
    stationShiftTargetId(org_id, site_id, dateString, shift_code, r.station_id, r.station_shift_status)
  );
  const targetIdSet = new Set(targetIds);

  let decisionsMap = new Map<
    string,
    { resolved: boolean; actions: string[]; created_at: string | null }
  >();

  const RESOLVED_CHOSEN = new Set(["acknowledged", "resolved", "plan_training", "swap", "escalate"]);

  if (targetIdSet.size > 0) {
    const { data: edRows } = await supabaseAdmin
      .from("execution_decisions")
      .select("target_id, status, actions, created_at")
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
      const resolved =
        RESOLVED_CHOSEN.has((chosen ?? "").toLowerCase()) ||
        (a && typeof (a as { resolved?: boolean }).resolved === "boolean" && (a as { resolved: boolean }).resolved);
      decisionsMap.set(tid, {
        resolved: !!resolved,
        actions: [...new Set(actions)],
        created_at: ed.created_at as string | null,
      });
    }
  }

  const issues: CockpitIssue[] = [];
  for (const r of rawList) {
    const severity = r.station_shift_status === "NO_GO" ? "BLOCKING" : "WARNING";
    const lineVal = r.area ?? "";
    const issueType = r.station_shift_status;

    const issueId = toIssueId(org_id, site_id, date, shift_code, lineVal, r.station_id, issueType);

    const targetId = stationShiftTargetId(org_id, site_id, dateString, shift_code, r.station_id, issueType);
    const dec = decisionsMap.get(targetId);

    if (!show_resolved && dec?.resolved) continue;

    const rootCause = {
      type: "station_issue",
      primary: r.station_shift_status === "NO_GO" ? "NO-GO: competence gap" : "WARNING: competence gap",
      causes: [] as string[],
      no_go_count: r.no_go_count,
      warning_count: r.warning_count,
    };

    const recommendedAction =
      r.station_shift_status === "NO_GO"
        ? "assign"
        : r.station_shift_status === "WARNING"
          ? "swap"
          : "";

    issues.push({
      issue_id: issueId,
      type: "SKILL",
      severity,
      issue_type: issueType,
      line: lineVal,
      shift_code,
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
    });
  }

  return debug ? { issues, debug: debugInfo } : { issues };
}

/** Normalize shift param: accept S1/S2/S3 or Day/Evening/Night, return canonical or null */
export function normalizeShiftParam(input?: string | null): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (/^s[1-3]$/i.test(raw)) return raw.toUpperCase();
  return normalizeShift(raw);
}

// Dev-only inline tests (manual checks; do not run in production)
// console.assert(normalizeShiftParam("Day") === "Day", "Normalize Day casing");
// console.assert(normalizeShiftParam("night") === "Night", "Normalize Night casing");
// console.assert(normalizeShiftParam("S1") === "S1", "Pass through seeded S1");
// console.assert(normalizeShiftParam("s2") === "S2", "Normalize seeded s2");
// console.assert(normalizeShiftParam("invalid") === null, "Reject invalid shift");
