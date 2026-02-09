/**
 * Single source of truth for cockpit execution_decisions.
 * Used by Summary (counts) and Issues (list). Must stay in sync.
 */
import { createClient } from "@supabase/supabase-js";
import { normalizeShift, normalizeShiftTypeOrDefault } from "@/lib/shift";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";
import { createHash } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type CockpitDecisionRow = {
  id: string;
  target_type: string;
  target_id: string;
  root_cause: unknown;
  actions: unknown;
  date: string;
  shift_code: string;
  line: string;
};

export function isBlocking(rootCause: unknown): boolean {
  if (rootCause == null || typeof rootCause !== "object") return true;
  const rc = rootCause as Record<string, unknown>;
  const b = rc.blocking;
  if (b === false || b === "false") return false;
  return true;
}

export function getActionStrings(actions: unknown): string[] {
  if (actions == null || typeof actions !== "object") return [];
  const a = actions as Record<string, unknown>;
  const selected = Array.isArray(a.selected) ? (a.selected as string[]) : [];
  const recommended = Array.isArray(a.recommended) ? (a.recommended as string[]) : [];
  return selected.length > 0 ? selected : recommended;
}

function toIssueId(targetType: string, targetId: string): string {
  const key = `ed:${targetType}:${targetId}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function decisionToIssue(row: CockpitDecisionRow): {
  issue_id: string;
  type: string;
  severity: "BLOCKING" | "WARNING";
  line: string;
  shift_code: string;
  date: string;
  root_cause: unknown;
  recommended_action: string;
} {
  const rc = row.root_cause as Record<string, unknown> | null | undefined;
  const type = rc && typeof rc.type === "string" ? rc.type : "unknown";
  const severity = isBlocking(row.root_cause) ? "BLOCKING" : "WARNING";
  const actions = getActionStrings(row.actions);
  const recommended_action = actions[0] ?? "";
  return {
    issue_id: toIssueId(row.target_type, row.target_id),
    type: type.toUpperCase(),
    severity,
    line: row.line,
    shift_code: row.shift_code,
    date: row.date,
    root_cause: row.root_cause,
    recommended_action,
  };
}

export type FetchCockpitDecisionsParams = {
  activeOrgId: string;
  activeSiteId: string | null;
  date?: string;
  shift?: string; // canonical Day|Evening|Night
  line?: string;
};

/**
 * Fetches execution_decisions using the same logic as Summary.
 * Returns enriched rows with date, shift_code, line for each decision.
 */
export async function fetchCockpitDecisions(
  params: FetchCockpitDecisionsParams
): Promise<CockpitDecisionRow[]> {
  const { activeOrgId, activeSiteId, date, shift: shiftFilter, line } = params;
  const sb = supabaseAdmin;

  if (date || shiftFilter || line) {
    let shiftsQuery = sb
      .from("shifts")
      .select("id, shift_date, shift_type, line")
      .eq("org_id", activeOrgId);

    if (date) shiftsQuery = shiftsQuery.eq("shift_date", date);
    if (shiftFilter) shiftsQuery = shiftsQuery.eq("shift_type", shiftFilter);
    if (line) shiftsQuery = shiftsQuery.eq("line", line);

    const { data: shiftRows, error: shiftsErr } = await shiftsQuery;

    if (shiftsErr) {
      console.error("[cockpitExecutionDecisions] shifts query error", shiftsErr);
      return [];
    }

    const shifts = (shiftRows || []) as Array<{
      id: string;
      shift_date?: string | null;
      shift_type?: string | null;
      line?: string | null;
    }>;
    const shiftIds = shifts.map((r) => r.id).filter(Boolean);
    if (shiftIds.length === 0) return [];

    const lineShiftIdToContext = new Map<
      string,
      { date: string; shift_code: string; line: string }
    >();
    for (const s of shifts) {
      if (s.shift_date != null && s.shift_type != null && s.line != null) {
        const d = String(s.shift_date).slice(0, 10);
        const sh = normalizeShiftTypeOrDefault(s.shift_type);
        const ln = String(s.line).trim();
        const lid = lineShiftTargetId(d, sh, ln);
        lineShiftIdToContext.set(lid, { date: d, shift_code: sh, line: ln });
      }
    }
    const lineShiftIds = [...lineShiftIdToContext.keys()];

    const { data: saRows, error: saErr } = await sb
      .from("shift_assignments")
      .select("id, shift_id")
      .in("shift_id", shiftIds);

    if (saErr) {
      console.error("[cockpitExecutionDecisions] shift_assignments query error", saErr);
      return [];
    }

    const saRowsList = (saRows || []) as Array<{ id: string; shift_id: string }>;
    const saIds = saRowsList.map((r) => r.id).filter(Boolean);
    const shiftIdToShift = new Map(shifts.map((s) => [s.id, s]));
    const saIdToContext = new Map<
      string,
      { date: string; shift_code: string; line: string }
    >();
    for (const sa of saRowsList) {
      const sh = shiftIdToShift.get(sa.shift_id);
      if (sh?.shift_date != null && sh?.shift_type != null && sh?.line != null) {
        saIdToContext.set(sa.id, {
          date: String(sh.shift_date).slice(0, 10),
          shift_code: normalizeShiftTypeOrDefault(sh.shift_type),
          line: String(sh.line).trim(),
        });
      }
    }

    const legacyQuery = sb
      .from("execution_decisions")
      .select("id, target_type, target_id, root_cause, actions")
      .eq("org_id", activeOrgId)
      .eq("status", "active")
      .eq("target_type", "shift_assignment")
      .in("target_id", saIds);
    const legacyWithSite =
      activeSiteId != null
        ? legacyQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`)
        : legacyQuery;

    const { data: legacyRows, error: legacyErr } = await legacyWithSite;

    if (legacyErr) {
      console.error("[cockpitExecutionDecisions] execution_decisions (shift_assignment) error", legacyErr);
    }

    let lineShiftRows: Array<{
      id: string;
      target_type: string;
      target_id: string;
      root_cause: unknown;
      actions: unknown;
    }> = [];
    if (lineShiftIds.length > 0) {
      let lineShiftQuery = sb
        .from("execution_decisions")
        .select("id, target_type, target_id, root_cause, actions")
        .eq("org_id", activeOrgId)
        .eq("status", "active")
        .eq("decision_type", "resolve_no_go")
        .eq("target_type", "line_shift")
        .in("target_id", lineShiftIds);
      if (activeSiteId != null) {
        lineShiftQuery = lineShiftQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
      }
      const { data: lsRows, error: lsErr } = await lineShiftQuery;
      if (!lsErr) lineShiftRows = (lsRows || []) as typeof lineShiftRows;
    }

    const result: CockpitDecisionRow[] = [];

    for (const row of (legacyRows || []) as Array<{
      id: string;
      target_type: string;
      target_id: string;
      root_cause: unknown;
      actions: unknown;
    }>) {
      const ctx = saIdToContext.get(row.target_id);
      if (ctx) {
        result.push({
          ...row,
          date: ctx.date,
          shift_code: ctx.shift_code,
          line: ctx.line,
        });
      }
    }

    for (const row of lineShiftRows) {
      const ctx = lineShiftIdToContext.get(row.target_id);
      if (ctx) {
        result.push({
          ...row,
          date: ctx.date,
          shift_code: ctx.shift_code,
          line: ctx.line,
        });
      }
    }

    return result;
  }

  let query = sb
    .from("execution_decisions")
    .select("id, target_type, target_id, root_cause, actions")
    .eq("org_id", activeOrgId)
    .eq("status", "active");

  if (activeSiteId != null) {
    query = query.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("[cockpitExecutionDecisions] execution_decisions query error", error);
    return [];
  }

  const list = (rows || []) as Array<{
    id: string;
    target_type: string;
    target_id: string;
    root_cause: unknown;
    actions: unknown;
  }>;

  const result: CockpitDecisionRow[] = [];
  for (const row of list) {
    const rc = row.root_cause as Record<string, unknown> | null | undefined;
    const d = rc && typeof rc.date === "string" ? rc.date : "";
    const sh = rc && typeof rc.shift === "string" ? rc.shift : "";
    const ln = rc && typeof rc.line === "string" ? rc.line : "";
    result.push({
      ...row,
      date: d || "",
      shift_code: sh || "",
      line: ln || "",
    });
  }
  return result;
}
