/**
 * GET /api/cockpit/requirements-summary-v2
 * Roster-scoped requirement counts for cockpit. Requires date + shift_code (shift context).
 * Auth: getActiveOrgFromSession. Scope: org_id + site_id + roster_employee_ids for that shift.
 * ?debug=1 adds _debug with roster_scoping, roster_employee_ids_count, source.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { getRosterEmployeeIdsForShift } from "@/lib/server/getRosterEmployeeIdsForShift";

type ViewRow = {
  employee_id: string;
  requirement_code: string;
  requirement_name: string | null;
  computed_status: string;
  criticality: string | null;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shiftCodeParam = (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  const wantDebug = url.searchParams.get("debug") === "1";

  if (!date || !shiftCodeParam) {
    return NextResponse.json(
      { ok: false, error: "SHIFT_CONTEXT_REQUIRED", message: "date and shift_code are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeShiftParam(shiftCodeParam);
  if (!normalized) {
    return NextResponse.json(
      { ok: false, error: "Invalid shift parameter", message: "shift_code must be one of Day, Evening, Night, S1, S2, S3" },
      { status: 400 }
    );
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = org.activeOrgId;
  const siteId = org.activeSiteId ?? null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    const res = NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const rosterEmployeeIds = await getRosterEmployeeIdsForShift(admin, {
      orgId,
      siteId,
      date,
      shift_code: normalized,
    });

    const emptyCounts = {
      total: 0,
      illegal: 0,
      warning: 0,
      go: 0,
      blocking_critical: 0,
      blocking_high: 0,
    };

    if (rosterEmployeeIds.length === 0) {
      const body: {
        ok: boolean;
        counts: typeof emptyCounts;
        top_requirements: Array<{
          requirement_code: string;
          requirement_name: string;
          illegal: number;
          warning: number;
          total: number;
          affected_employee_count?: number;
        }>;
        _debug?: {
          source: string;
          scope_inputs: { org_id: string; site_id: string | null; date: string; shift_code: string; roster_scoping: boolean; roster_employee_ids_count: number };
          requirement_count: number;
          aggregation_row_count: number;
        };
      } = {
        ok: true,
        counts: emptyCounts,
        top_requirements: [],
      };
      if (wantDebug) {
        body._debug = {
          source: "view:v_employee_requirement_status",
          scope_inputs: {
            org_id: orgId,
            site_id: siteId,
            date,
            shift_code: normalized,
            roster_scoping: true,
            roster_employee_ids_count: 0,
          },
          requirement_count: 0,
          aggregation_row_count: 0,
        };
      }
      const res = NextResponse.json(body);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = admin
      .from("v_employee_requirement_status")
      .select("employee_id, requirement_code, requirement_name, computed_status, criticality")
      .eq("org_id", orgId)
      .in("employee_id", rosterEmployeeIds);
    if (siteId) {
      query = query.or(`site_id.is.null,site_id.eq.${siteId}`);
    }
    const { data: rows, error } = await query;

    if (error) {
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch requirement status" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const list = (rows ?? []) as ViewRow[];

    let total = 0;
    let illegal = 0;
    let warning = 0;
    let go = 0;
    let blocking_critical = 0;
    let blocking_high = 0;

    const byRequirement = new Map<
      string,
      { requirement_name: string; illegal: number; warning: number; total: number; affected: Set<string> }
    >();

    for (const r of list) {
      total += 1;
      if (r.computed_status === "ILLEGAL") {
        illegal += 1;
        if (r.criticality === "CRITICAL") blocking_critical += 1;
        if (r.criticality === "HIGH") blocking_high += 1;
      } else if (r.computed_status === "WARNING") {
        warning += 1;
      } else {
        go += 1;
      }

      const code = r.requirement_code;
      const name = r.requirement_name ?? "";
      if (!byRequirement.has(code)) {
        byRequirement.set(code, { requirement_name: name, illegal: 0, warning: 0, total: 0, affected: new Set() });
      }
      const rec = byRequirement.get(code)!;
      rec.total += 1;
      rec.affected.add(r.employee_id);
      if (r.computed_status === "ILLEGAL") rec.illegal += 1;
      else if (r.computed_status === "WARNING") rec.warning += 1;
    }

    const top_requirements = Array.from(byRequirement.entries())
      .map(([requirement_code, rec]) => ({
        requirement_code,
        requirement_name: rec.requirement_name,
        illegal: rec.illegal,
        warning: rec.warning,
        total: rec.total,
        affected_employee_count: rec.affected.size,
      }))
      .sort((a, b) => {
        const ordA = a.illegal + a.warning;
        const ordB = b.illegal + b.warning;
        if (ordB !== ordA) return ordB - ordA;
        if (b.illegal !== a.illegal) return b.illegal - a.illegal;
        if (b.warning !== a.warning) return b.warning - a.warning;
        return (a.requirement_code ?? "").localeCompare(b.requirement_code ?? "");
      })
      .slice(0, 10);

    const counts = {
      total,
      illegal,
      warning,
      go,
      blocking_critical,
      blocking_high,
    };

    const body: {
      ok: boolean;
      counts: typeof counts;
      top_requirements: typeof top_requirements;
      _debug?: {
        source: string;
        scope_inputs: { org_id: string; site_id: string | null; date: string; shift_code: string; roster_scoping: boolean; roster_employee_ids_count: number };
        requirement_count: number;
        aggregation_row_count: number;
      };
    } = {
      ok: true,
      counts,
      top_requirements,
    };
    if (wantDebug) {
      body._debug = {
        source: "view:v_employee_requirement_status",
        scope_inputs: {
          org_id: orgId,
          site_id: siteId,
          date,
          shift_code: normalized,
          roster_scoping: true,
          roster_employee_ids_count: rosterEmployeeIds.length,
        },
        requirement_count: byRequirement.size,
        aggregation_row_count: list.length,
      };
    }

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
