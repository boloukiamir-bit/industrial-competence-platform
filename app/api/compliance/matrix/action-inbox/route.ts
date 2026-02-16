/**
 * GET /api/compliance/matrix/action-inbox — aggregated per-employee compliance counts for Action Inbox.
 * Optional query params: station_id, date, shift_code (scopes to roster employees).
 * Source of truth: v_employee_compliance_status. Primary blockers from v_employee_compliance_blockers_pilot.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getRosterEmployeeIdsForStationShiftServer } from "@/lib/server/roster";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

type EmployeeRow = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  employee_number: string | null;
  line: string | null;
};

type StatusRow = {
  employee_id: string;
  compliance_code: string;
  compliance_name: string;
  status: string;
  valid_to: string | null;
  days_left: number | null;
};

type BlockerRow = {
  employee_id: string;
  compliance_code: string;
  compliance_name: string;
  valid_to: string | null;
  days_left: number | null;
};

type ActionInboxTab = "expired" | "expiring" | "missing" | "valid";

type ActionInboxSummaryEntry = {
  employees: number;
  total_items: number;
  top_categories: Array<{ compliance_name: string; count: number }>;
};

type StationInfo = {
  id: string;
  code: string | null;
  name: string | null;
  line: string | null;
};

const ACTION_TABS: ActionInboxTab[] = ["expired", "expiring", "missing", "valid"];

function resolveEmployeeTab(counts: { missing: number; expiring: number; expired: number; valid: number }): ActionInboxTab {
  if (counts.expired > 0) return "expired";
  if (counts.expiring > 0) return "expiring";
  if (counts.missing > 0) return "missing";
  return "valid";
}

function resolveStatusTab(status: string): ActionInboxTab {
  if (status === "EXPIRED") return "expired";
  if (status === "EXPIRING_7" || status === "EXPIRING_30") return "expiring";
  if (status === "MISSING") return "missing";
  return "valid";
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    const res = NextResponse.json(errorPayload("forbidden", "Not an org member"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;
    const searchParams = request.nextUrl.searchParams;
    const debugMode = searchParams.get("debug") === "1";
    const stationId = searchParams.get("station_id")?.trim() || "";
    const shiftCode = searchParams.get("shift_code")?.trim() || "";
    const date = searchParams.get("date")?.trim() || "";

    let station: StationInfo | null = null;
    if (stationId) {
      const { data: stationRow, error: stationErr } = await supabaseAdmin
        .from("stations")
        .select("id, code, name, line")
        .eq("org_id", orgId)
        .eq("id", stationId)
        .maybeSingle();
      if (stationErr) {
        console.error("[compliance/matrix/action-inbox] station lookup error:", stationErr);
      } else if (stationRow) {
        station = {
          id: stationRow.id,
          code: stationRow.code ?? null,
          name: stationRow.name ?? null,
          line: stationRow.line ?? null,
        };
      }
    }

    const rosterEmployeeIds = stationId
      ? await getRosterEmployeeIdsForStationShiftServer(supabaseAdmin, {
          orgId,
          siteId: activeSiteId,
          stationId,
          shiftCode,
          date,
        })
      : null;
    const rosterCount = rosterEmployeeIds ? rosterEmployeeIds.length : 0;

    if (stationId && rosterEmployeeIds && rosterEmployeeIds.length === 0) {
      const emptySummary: Record<ActionInboxTab, ActionInboxSummaryEntry> = {
        expired: { employees: 0, total_items: 0, top_categories: [] },
        expiring: { employees: 0, total_items: 0, top_categories: [] },
        missing: { employees: 0, total_items: 0, top_categories: [] },
        valid: { employees: 0, total_items: 0, top_categories: [] },
      };
      const res = NextResponse.json({
        ok: true,
        employees: [],
        summary: emptySummary,
        activeSiteId: activeSiteId ?? null,
        station,
        ...(debugMode && {
          debug: {
            station,
            roster_employee_ids_count: rosterCount,
            filters: { station_id: stationId || null, shift_code: shiftCode || null, date: date || null },
          },
        }),
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (rosterEmployeeIds && rosterEmployeeIds.length > 0) {
      employeesQuery = employeesQuery.in("id", rosterEmployeeIds);
    }
    if (activeSiteId) {
      employeesQuery = employeesQuery.or(`site_id.eq.${activeSiteId},site_id.is.null`);
    }
    const { data: employees, error: empErr } = await employeesQuery.order("name");
    if (empErr) {
      const res = NextResponse.json(errorPayload("employees", empErr.message, empErr.details ?? undefined), {
        status: 500,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let statusQuery = supabaseAdmin
      .from("v_employee_compliance_status")
      .select("employee_id, compliance_code, compliance_name, status, valid_to, days_left")
      .eq("org_id", orgId);
    if (rosterEmployeeIds && rosterEmployeeIds.length > 0) {
      statusQuery = statusQuery.in("employee_id", rosterEmployeeIds);
    }
    if (activeSiteId) {
      statusQuery = statusQuery.or(`site_id.eq.${activeSiteId},site_id.is.null`);
    }
    const { data: statusRows, error: statusErr } = await statusQuery;
    if (statusErr) {
      const res = NextResponse.json(errorPayload("status", statusErr.message, statusErr.details ?? undefined), {
        status: 500,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let blockersQuery = supabaseAdmin
      .from("v_employee_compliance_blockers_pilot")
      .select("employee_id, compliance_code, compliance_name, valid_to, days_left")
      .eq("org_id", orgId);
    if (rosterEmployeeIds && rosterEmployeeIds.length > 0) {
      blockersQuery = blockersQuery.in("employee_id", rosterEmployeeIds);
    }
    if (activeSiteId) {
      blockersQuery = blockersQuery.or(`site_id.eq.${activeSiteId},site_id.is.null`);
    }
    const { data: blockerRows, error: blockerErr } = await blockersQuery;
    if (blockerErr) {
      const res = NextResponse.json(errorPayload("blockers", blockerErr.message, blockerErr.details ?? undefined), {
        status: 500,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const countsByEmployee = new Map<
      string,
      { missing: number; expiring: number; expired: number; valid: number }
    >();
    for (const emp of employees ?? []) {
      countsByEmployee.set(emp.id, { missing: 0, expiring: 0, expired: 0, valid: 0 });
    }

    for (const row of (statusRows as StatusRow[]) ?? []) {
      if (!countsByEmployee.has(row.employee_id)) continue;
      const bucket = countsByEmployee.get(row.employee_id) ?? {
        missing: 0,
        expiring: 0,
        expired: 0,
        valid: 0,
      };
      if (row.status === "MISSING") bucket.missing += 1;
      else if (row.status === "EXPIRED") bucket.expired += 1;
      else if (row.status === "EXPIRING_7" || row.status === "EXPIRING_30") bucket.expiring += 1;
      else bucket.valid += 1;
      countsByEmployee.set(row.employee_id, bucket);
    }

    const primaryBlockerByEmployee = new Map<string, BlockerRow>();
    for (const row of (blockerRows as BlockerRow[]) ?? []) {
      const existing = primaryBlockerByEmployee.get(row.employee_id);
      if (!existing) {
        primaryBlockerByEmployee.set(row.employee_id, row);
        continue;
      }
      const existingDate = existing.valid_to ? new Date(existing.valid_to).getTime() : Infinity;
      const nextDate = row.valid_to ? new Date(row.valid_to).getTime() : Infinity;
      if (nextDate < existingDate) {
        primaryBlockerByEmployee.set(row.employee_id, row);
      }
    }

    const employeeList = (employees as EmployeeRow[] | null) ?? [];
    const summary: Record<ActionInboxTab, ActionInboxSummaryEntry> = {
      expired: { employees: 0, total_items: 0, top_categories: [] },
      expiring: { employees: 0, total_items: 0, top_categories: [] },
      missing: { employees: 0, total_items: 0, top_categories: [] },
      valid: { employees: 0, total_items: 0, top_categories: [] },
    };
    const tabByEmployee = new Map<string, ActionInboxTab>();

    const payload = employeeList.map((emp) => {
      const name =
        emp.name?.trim() ||
        [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim() ||
        emp.employee_number ||
        emp.id;
      const counts = countsByEmployee.get(emp.id) ?? {
        missing: 0,
        expiring: 0,
        expired: 0,
        valid: 0,
      };
      const primary = primaryBlockerByEmployee.get(emp.id) ?? null;
      const tab = resolveEmployeeTab(counts);
      tabByEmployee.set(emp.id, tab);
      summary[tab].employees += 1;
      if (tab === "expired") summary[tab].total_items += counts.expired;
      else if (tab === "expiring") summary[tab].total_items += counts.expiring;
      else if (tab === "missing") summary[tab].total_items += counts.missing;
      else summary[tab].total_items += counts.valid;
      return {
        employee_id: emp.id,
        employee_name: name,
        employee_number: emp.employee_number ?? null,
        line: emp.line ?? null,
        missing_count: counts.missing,
        expiring_count: counts.expiring,
        expired_count: counts.expired,
        valid_count: counts.valid,
        primary_blocker: primary
          ? {
              compliance_code: primary.compliance_code,
              compliance_name: primary.compliance_name,
              valid_to: primary.valid_to,
              days_left: primary.days_left,
            }
          : null,
      };
    });

    const categoryCounts: Record<ActionInboxTab, Map<string, number>> = {
      expired: new Map(),
      expiring: new Map(),
      missing: new Map(),
      valid: new Map(),
    };

    for (const row of (statusRows as StatusRow[]) ?? []) {
      const tab = resolveStatusTab(row.status);
      if (tabByEmployee.get(row.employee_id) !== tab) continue;
      const name = row.compliance_name || row.compliance_code;
      const bucket = categoryCounts[tab];
      bucket.set(name, (bucket.get(name) ?? 0) + 1);
    }

    for (const tab of ACTION_TABS) {
      const top = Array.from(categoryCounts[tab].entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([compliance_name, count]) => ({ compliance_name, count }));
      summary[tab].top_categories = top;
    }

    payload.sort((a, b) => {
      const aExpired = a.expired_count > 0 ? 0 : 1;
      const bExpired = b.expired_count > 0 ? 0 : 1;
      if (aExpired !== bExpired) return aExpired - bExpired;
      if (a.expired_count !== b.expired_count) return b.expired_count - a.expired_count;
      const aProblem = a.missing_count + a.expiring_count;
      const bProblem = b.missing_count + b.expiring_count;
      if (aProblem !== bProblem) return bProblem - aProblem;
      const nameCmp = a.employee_name.localeCompare(b.employee_name);
      if (nameCmp !== 0) return nameCmp;
      return a.employee_id.localeCompare(b.employee_id);
    });

    const res = NextResponse.json({
      ok: true,
      employees: payload,
      summary,
      activeSiteId: activeSiteId ?? null,
      station,
      ...(debugMode && {
        debug: {
          station,
          roster_employee_ids_count: rosterCount,
          filters: { station_id: stationId || null, shift_code: shiftCode || null, date: date || null },
        },
      }),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
