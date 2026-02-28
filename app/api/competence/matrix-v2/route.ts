/**
 * GET /api/competence/matrix-v2
 * Roster-scoped competence matrix engine: operational readiness for a shift.
 * Deterministic outputs; audit-friendly breakdowns by station and by employee.
 *
 * Required: date=YYYY-MM-DD, shift_code=Day|Evening|Night|S1|S2|S3
 * Optional: debug=1
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { getRosterEmployeeIdsForShift } from "@/lib/server/getRosterEmployeeIdsForShift";
import {
  buildStationRequirements,
  buildEmployeeLevels,
  computeStationReadiness,
  shiftOpsReadinessFromStations,
  type OpsStatus,
  type StationReadiness,
  type GapReason,
} from "@/lib/server/competence/stationReadiness";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOP_STATIONS = 50;
const TOP_EMPLOYEES = 50;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

/** Severity order for sorting: NO_GO first, then WARNING, then GO. */
function stationSeverityOrder(a: StationReadiness, b: StationReadiness): number {
  const order: Record<OpsStatus, number> = { OPS_NO_GO: 0, OPS_WARNING: 1, OPS_GO: 2 };
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
  if (a.eligible_employees_count !== b.eligible_employees_count)
    return a.eligible_employees_count - b.eligible_employees_count;
  return (a.station_code ?? "").localeCompare(b.station_code ?? "");
}

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
      {
        ok: false,
        error: "Invalid shift parameter",
        message: "shift_code must be one of Day, Evening, Night, S1, S2, S3",
      },
      { status: 400 }
    );
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = org.activeOrgId;
  const siteId = org.activeSiteId ?? null;

  try {
    const rosterEmployeeIds = await getRosterEmployeeIdsForShift(supabaseAdmin, {
      orgId,
      siteId,
      date,
      shift_code: normalized,
    });

    const emptyKpis = {
      roster_employee_count: 0,
      stations_total: 0,
      stations_no_go: 0,
      stations_warning: 0,
      stations_go: 0,
    };

    if (rosterEmployeeIds.length === 0) {
      const body = {
        ok: true as const,
        ops_readiness_flag: "OPS_NO_GO" as const,
        kpis: emptyKpis,
        by_station: [] as Array<{
          station_id: string;
          station_code: string;
          station_name: string;
          line: string | null;
          status: OpsStatus;
          required_skills_count: number;
          eligible_employees_count: number;
          gap_reasons: GapReason[];
        }>,
        has_more_stations: false,
        by_employee: [] as Array<{
          employee_id: string;
          employee_name: string;
          eligible_stations_count: number;
          blocked_stations_count: number;
          top_gaps: Array<{ station_code: string; missing_skills: string[] }>;
        }>,
        has_more_employees: false,
        _debug: wantDebug
          ? {
              org_id: orgId,
              site_id: siteId,
              date,
              shift_code: normalized,
              roster_employee_ids_count: 0,
              stations_queried: 0,
              requirements_rows: 0,
              ratings_rows: 0,
            }
          : undefined,
      };
      const res = NextResponse.json(body);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // 1) Stations (org-wide; no line filter for now)
    const { data: stationsRows, error: stationsErr } = await supabaseAdmin
      .from("stations")
      .select("id, code, name, line")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (stationsErr) {
      const res = NextResponse.json(errorPayload("stations", stationsErr), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stations = (stationsRows ?? []) as Array<{
      id: string;
      code: string | null;
      name: string | null;
      line: string | null;
    }>;
    const stationIds = stations.map((s) => s.id);
    const stationsQueried = stations.length;

    if (stationIds.length === 0) {
      const { data: empRows0 } = await supabaseAdmin
        .from("employees")
        .select("id, name, first_name, last_name, employee_number")
        .eq("org_id", orgId)
        .in("id", rosterEmployeeIds);
      const empList0 = (empRows0 ?? []) as Array<{
        id: string;
        name: string | null;
        first_name: string | null;
        last_name: string | null;
        employee_number: string | null;
      }>;
      const nameById0 = new Map<string, string>();
      for (const e of empList0) {
        const name =
          (e.name ?? [e.first_name, e.last_name].filter(Boolean).join(" ").trim()) || (e.employee_number ?? e.id);
        nameById0.set(e.id, name);
      }
      const by_employee_empty = rosterEmployeeIds.slice(0, TOP_EMPLOYEES).map((employee_id) => ({
        employee_id,
        employee_name: nameById0.get(employee_id) ?? employee_id,
        eligible_stations_count: 0,
        blocked_stations_count: 0,
        top_gaps: [] as Array<{ station_code: string; missing_skills: string[] }>,
      }));
      const body = {
        ok: true as const,
        ops_readiness_flag: "OPS_GO" as const,
        kpis: {
          roster_employee_count: rosterEmployeeIds.length,
          stations_total: 0,
          stations_no_go: 0,
          stations_warning: 0,
          stations_go: 0,
        },
        by_station: [],
        has_more_stations: false,
        by_employee: by_employee_empty,
        has_more_employees: rosterEmployeeIds.length > TOP_EMPLOYEES,
        _debug: wantDebug
          ? {
              org_id: orgId,
              site_id: siteId,
              date,
              shift_code: normalized,
              roster_employee_ids_count: rosterEmployeeIds.length,
              stations_queried: 0,
              requirements_rows: 0,
              ratings_rows: 0,
            }
          : undefined,
      };
      const res = NextResponse.json(body);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // 2) Station skill requirements (MANDATORY only: is_mandatory !== false)
    const { data: reqRows, error: reqErr } = await supabaseAdmin
      .from("station_skill_requirements")
      .select("station_id, skill_id, required_level, is_mandatory")
      .eq("org_id", orgId)
      .in("station_id", stationIds);

    if (reqErr) {
      const res = NextResponse.json(errorPayload("station_skill_requirements", reqErr), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const requirementRowsRaw = (reqRows ?? []) as Array<{
      station_id: string;
      skill_id: string;
      required_level: number;
      is_mandatory?: boolean | null;
    }>;
    const requirementRows = requirementRowsRaw.filter((r) => r.is_mandatory !== false);
    const requirementsRowsCount = requirementRows.length;

    const requiredSkillIds = [...new Set(requirementRows.map((r) => r.skill_id).filter(Boolean))];
    const skillCodeById = new Map<string, string>();
    if (requiredSkillIds.length > 0) {
      const { data: skillsRows } = await supabaseAdmin
        .from("skills")
        .select("id, code")
        .eq("org_id", orgId)
        .in("id", requiredSkillIds);
      for (const s of skillsRows ?? []) {
        const row = s as { id: string; code: string | null };
        if (row.code != null) skillCodeById.set(row.id, row.code);
      }
    }

    const stationReqs = buildStationRequirements(
      requirementRows.map((r) => ({ station_id: r.station_id, skill_id: r.skill_id, required_level: r.required_level })),
      skillCodeById
    );

    // 3) Employee skills (roster only)
    let employeeSkillRows: Array<{ employee_id: string; skill_id: string; level: number | null }> = [];
    if (requiredSkillIds.length > 0) {
      const { data: esRows, error: esErr } = await supabaseAdmin
        .from("employee_skills")
        .select("employee_id, skill_id, level")
        .in("employee_id", rosterEmployeeIds)
        .in("skill_id", requiredSkillIds);
      if (esErr) {
        const res = NextResponse.json(errorPayload("employee_skills", esErr), { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      employeeSkillRows = (esRows ?? []) as Array<{ employee_id: string; skill_id: string; level: number | null }>;
    }
    const ratingsRowsCount = employeeSkillRows.length;
    const employeeLevels = buildEmployeeLevels(employeeSkillRows);

    const stationById = new Map(stations.map((s) => [s.id, s]));
    const byStation: StationReadiness[] = [];
    for (const s of stations) {
      const reqs = stationReqs.get(s.id) ?? [];
      const readiness = computeStationReadiness(
        s.id,
        s.code ?? s.id,
        s.name ?? s.code ?? s.id,
        s.line,
        reqs,
        rosterEmployeeIds,
        employeeLevels
      );
      byStation.push(readiness);
    }

    byStation.sort(stationSeverityOrder);
    const stationStatuses = byStation.map((x) => x.status);
    const ops_readiness_flag = shiftOpsReadinessFromStations(stationStatuses);

    const stations_no_go = stationStatuses.filter((x) => x === "OPS_NO_GO").length;
    const stations_warning = stationStatuses.filter((x) => x === "OPS_WARNING").length;
    const stations_go = stationStatuses.filter((x) => x === "OPS_GO").length;

    const by_station = byStation.slice(0, TOP_STATIONS).map((r) => ({
      station_id: r.station_id,
      station_code: r.station_code,
      station_name: r.station_name,
      line: r.line,
      status: r.status,
      required_skills_count: r.required_skills_count,
      eligible_employees_count: r.eligible_employees_count,
      gap_reasons: r.gap_reasons,
    }));
    const has_more_stations = byStation.length > TOP_STATIONS;

    // by_employee: eligible_stations_count, blocked_stations_count, top_gaps
    const { data: empRows } = await supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number")
      .eq("org_id", orgId)
      .in("id", rosterEmployeeIds);
    const empList = (empRows ?? []) as Array<{
      id: string;
      name: string | null;
      first_name: string | null;
      last_name: string | null;
      employee_number: string | null;
    }>;
    const employeeNameById = new Map<string, string>();
    for (const e of empList) {
      const name =
        (e.name ?? [e.first_name, e.last_name].filter(Boolean).join(" ").trim()) || (e.employee_number ?? e.id);
      employeeNameById.set(e.id, name);
    }

    const byEmployeeRaw = rosterEmployeeIds.map((employee_id) => {
      const levels = employeeLevels.get(employee_id);
      let eligible_stations_count = 0;
      const blockedGaps: Array<{ station_code: string; missing_skills: string[] }> = [];
      for (const st of byStation) {
        const reqs = stationReqs.get(st.station_id) ?? [];
        if (reqs.length === 0) {
          eligible_stations_count += 1;
          continue;
        }
        let passes = true;
        const missing_skills: string[] = [];
        for (const req of reqs) {
          const level = levels?.get(req.skill_id);
          if (typeof level !== "number" || level < req.required_level) {
            passes = false;
            missing_skills.push(req.skill_code);
          }
        }
        if (passes) eligible_stations_count += 1;
        else blockedGaps.push({ station_code: st.station_code, missing_skills });
      }
      const blocked_stations_count = byStation.length - eligible_stations_count;
      return {
        employee_id,
        employee_name: employeeNameById.get(employee_id) ?? employee_id,
        eligible_stations_count,
        blocked_stations_count,
        top_gaps: blockedGaps.slice(0, 10),
      };
    });
    byEmployeeRaw.sort((a, b) => {
      if (a.blocked_stations_count !== b.blocked_stations_count)
        return b.blocked_stations_count - a.blocked_stations_count;
      return (a.employee_name ?? "").localeCompare(b.employee_name ?? "");
    });
    const by_employee = byEmployeeRaw.slice(0, TOP_EMPLOYEES);
    const has_more_employees = byEmployeeRaw.length > TOP_EMPLOYEES;

    const body = {
      ok: true as const,
      ops_readiness_flag,
      kpis: {
        roster_employee_count: rosterEmployeeIds.length,
        stations_total: byStation.length,
        stations_no_go: stations_no_go,
        stations_warning: stations_warning,
        stations_go: stations_go,
      },
      by_station,
      has_more_stations,
      by_employee,
      has_more_employees,
      _debug: wantDebug
        ? {
            org_id: orgId,
            site_id: siteId,
            date,
            shift_code: normalized,
            roster_employee_ids_count: rosterEmployeeIds.length,
            stations_queried: stationsQueried,
            requirements_rows: requirementsRowsCount,
            ratings_rows: ratingsRowsCount,
          }
        : undefined,
    };

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

