/**
 * GET /api/cockpit/summary-v2
 * Single aggregated endpoint for minimal Cockpit: Production Readiness, Legal Readiness, Critical Gaps.
 * Params: date (YYYY-MM-DD), shift_code (S1|S2|S3|Day|Evening|Night), line (optional).
 * Scope: org_id, site_id from session; selected shift (date + shift_code).
 * Target: <200ms locally.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ProductionReadiness = {
  total_stations: number;
  staffed_stations: number;
  unstaffed_stations: number;
  readiness_percent: number;
  status: "GO" | "WARNING" | "NO_GO";
};

export type LegalReadiness = {
  employees_with_expired: number;
  employees_missing_mandatory: number;
  total_assigned: number;
  status: "LEGAL_STOP" | "WARNING" | "OK";
};

export type CriticalGapRow = {
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  severity: number;
  gap_count: number;
};

export type HrBlockers = {
  overdue_required_steps: number;
  blocked_steps: number;
};

export type CockpitSummaryV2Response = {
  ok: true;
  production_readiness: ProductionReadiness;
  legal_readiness: LegalReadiness;
  critical_gaps: CriticalGapRow[];
  hr_blockers: HrBlockers;
  no_data: boolean;
};

function parseDate(v: string | null | undefined): string | null {
  const s = v?.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = parseDate(searchParams.get("date"));
    const rawShift = searchParams.get("shift_code") ?? searchParams.get("shift");
    const shiftCode = normalizeShiftParam(rawShift);
    const lineParam = (searchParams.get("line") ?? searchParams.get("area"))?.trim();
    const lineFilter = lineParam && lineParam !== "all" ? lineParam : undefined;

    if (!date || !shiftCode) {
      const res = NextResponse.json(
        { error: "date and shift_code are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = org.activeOrgId;
    const siteId = org.activeSiteId;

    // 1) Resolve shift IDs (org, site, date, shift_code; optional line)
    let shiftsQuery = supabaseAdmin
      .from("shifts")
      .select("id, area_id")
      .eq("org_id", orgId)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode);
    if (siteId) {
      shiftsQuery = shiftsQuery.or(`site_id.is.null,site_id.eq.${siteId}`);
    }
    const { data: shifts, error: shiftsErr } = await shiftsQuery;
    if (shiftsErr) {
      console.error("[cockpit/summary-v2] shifts error:", shiftsErr);
      const res = NextResponse.json(
        { error: "Failed to load shifts", details: shiftsErr.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftsList = (shifts ?? []) as Array<{ id: string; area_id: string | null }>;
    let shiftIds = shiftsList.map((s) => s.id);
    if (lineFilter && shiftIds.length > 1) {
      const { data: areas } = await supabaseAdmin
        .from("areas")
        .select("id, code")
        .eq("org_id", orgId)
        .eq("is_active", true);
      const areaByCode = new Map(
        (areas ?? []).map((a: { id: string; code: string }) => [a.code?.trim().toUpperCase(), a.id])
      );
      const lineAreaId = areaByCode.get(lineFilter.toUpperCase());
      if (lineAreaId) {
        shiftIds = shiftsList.filter((s) => s.area_id === lineAreaId).map((s) => s.id);
      }
    }

    if (shiftIds.length === 0) {
      const emptyProduction: ProductionReadiness = {
        total_stations: 0,
        staffed_stations: 0,
        unstaffed_stations: 0,
        readiness_percent: 0,
        status: "NO_GO",
      };
      const emptyLegal: LegalReadiness = {
        employees_with_expired: 0,
        employees_missing_mandatory: 0,
        total_assigned: 0,
        status: "OK",
      };
      const res = NextResponse.json({
        ok: true,
        production_readiness: emptyProduction,
        legal_readiness: emptyLegal,
        critical_gaps: [],
        hr_blockers: { overdue_required_steps: 0, blocked_steps: 0 },
        no_data: true,
      } satisfies CockpitSummaryV2Response);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // 2) Production readiness: shift_assignments for these shift_ids
    const { data: assignments, error: assignErr } = await supabaseAdmin
      .from("shift_assignments")
      .select("id, shift_id, station_id, employee_id")
      .eq("org_id", orgId)
      .in("shift_id", shiftIds);

    if (assignErr) {
      console.error("[cockpit/summary-v2] shift_assignments error:", assignErr);
      const res = NextResponse.json(
        { error: "Failed to load assignments", details: assignErr.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rows = (assignments ?? []) as Array<{
      id: string;
      shift_id: string;
      station_id: string;
      employee_id: string | null;
    }>;
    const total_stations = rows.length;
    const staffed_stations = rows.filter((r) => r.employee_id != null).length;
    const unstaffed_stations = total_stations - staffed_stations;
    const readiness_percent =
      total_stations > 0 ? Math.round((staffed_stations / total_stations) * 100) : 0;
    const productionStatus: "GO" | "WARNING" | "NO_GO" =
      readiness_percent >= 90 ? "GO" : readiness_percent >= 70 ? "WARNING" : "NO_GO";

    const production_readiness: ProductionReadiness = {
      total_stations,
      staffed_stations,
      unstaffed_stations,
      readiness_percent,
      status: productionStatus,
    };

    // 3) Legal readiness: employees assigned in this shift
    const assignedEmployeeIds = [...new Set(rows.map((r) => r.employee_id).filter(Boolean))] as string[];
    let employees_with_expired = 0;
    let employees_missing_mandatory = 0;

    if (assignedEmployeeIds.length > 0) {
      const chunk = 500;
      const expiredSet = new Set<string>();
      const missingSet = new Set<string>();
      for (let i = 0; i < assignedEmployeeIds.length; i += chunk) {
        const ids = assignedEmployeeIds.slice(i, i + chunk);
        const { data: statusRows, error: statusErr } = await supabaseAdmin
          .from("v_employee_compliance_status")
          .select("employee_id, status")
          .eq("org_id", orgId)
          .in("employee_id", ids);
        if (statusErr) {
          console.error("[cockpit/summary-v2] v_employee_compliance_status error:", statusErr);
          break;
        }
        for (const r of statusRows ?? []) {
          const eid = (r as { employee_id?: string }).employee_id;
          const st = String((r as { status?: string }).status ?? "").toUpperCase();
          if (!eid) continue;
          if (st === "EXPIRED") expiredSet.add(eid);
          else if (st === "MISSING") missingSet.add(eid);
        }
      }
      employees_with_expired = expiredSet.size;
      employees_missing_mandatory = missingSet.size;
    }

    const legalStatus: "LEGAL_STOP" | "WARNING" | "OK" =
      employees_with_expired > 0
        ? "LEGAL_STOP"
        : employees_missing_mandatory > 0
          ? "WARNING"
          : "OK";

    const legal_readiness: LegalReadiness = {
      employees_with_expired,
      employees_missing_mandatory,
      total_assigned: assignedEmployeeIds.length,
      status: legalStatus,
    };

    // 4) Critical gaps: stations where required_level > assigned_employee level (top 5 by severity)
    const staffedRows = rows.filter((r) => r.employee_id != null);
    const stationIds = [...new Set(staffedRows.map((r) => r.station_id))];
    let critical_gaps: CriticalGapRow[] = [];

    if (stationIds.length > 0 && siteId) {
      const empIds = [...new Set(staffedRows.map((r) => r.employee_id))] as string[];
      const { data: empRows } = await supabaseAdmin
        .from("employees")
        .select("id, employee_number")
        .eq("org_id", orgId)
        .in("id", empIds);
      const empIdToAnst = new Map(
        (empRows ?? []).map((e: { id: string; employee_number: string | null }) => [
          e.id,
          (e.employee_number ?? "").trim(),
        ])
      );

      const { data: reqRows } = await supabaseAdmin
        .from("station_skill_requirements")
        .select("station_id, skill_code, required_level")
        .eq("org_id", orgId)
        .eq("site_id", siteId)
        .in("station_id", stationIds);

      const { data: ratingRows } = await supabaseAdmin
        .from("employee_skill_ratings")
        .select("station_id, employee_anst_id, skill_code, level")
        .eq("org_id", orgId)
        .eq("site_id", siteId)
        .in("station_id", stationIds)
        .or("valid_to.is.null,valid_to.gte." + date);

      const requirements = (reqRows ?? []) as Array<{
        station_id: string;
        skill_code: string;
        required_level: number;
      }>;
      const ratings = (ratingRows ?? []) as Array<{
        station_id: string;
        employee_anst_id: string;
        skill_code: string;
        level: number;
      }>;
      const ratingKey = (st: string, anst: string, skill: string) => `${st}:${anst}:${skill}`;
      const ratingMap = new Map(
        ratings.map((r) => [ratingKey(r.station_id, r.employee_anst_id, r.skill_code), r.level])
      );

      const stationSeverity = new Map<string, { severity: number; gap_count: number }>();
      for (const row of staffedRows) {
        const anst = empIdToAnst.get(row.employee_id!);
        if (!anst) continue;
        const stationReqs = requirements.filter((r) => r.station_id === row.station_id);
        let severity = 0;
        let gap_count = 0;
        for (const req of stationReqs) {
          const actual = ratingMap.get(
            ratingKey(row.station_id, anst, req.skill_code)
          );
          const actualLevel = actual ?? 0;
          if (req.required_level > actualLevel) {
            severity += req.required_level - actualLevel;
            gap_count += 1;
          }
        }
        if (gap_count > 0) {
          const cur = stationSeverity.get(row.station_id) ?? { severity: 0, gap_count: 0 };
          stationSeverity.set(row.station_id, {
            severity: cur.severity + severity,
            gap_count: cur.gap_count + gap_count,
          });
        }
      }

      const gapStations = Array.from(stationSeverity.entries())
        .map(([station_id, v]) => ({ station_id, ...v }))
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 5);

      if (gapStations.length > 0) {
        const { data: stationMeta } = await supabaseAdmin
          .from("stations")
          .select("id, code, name")
          .eq("org_id", orgId)
          .in("id", gapStations.map((g) => g.station_id));
        const metaMap = new Map(
          (stationMeta ?? []).map((s: { id: string; code: string | null; name: string | null }) => [
            s.id,
            { code: s.code, name: s.name },
          ])
        );
        critical_gaps = gapStations.map((g) => ({
          station_id: g.station_id,
          station_code: metaMap.get(g.station_id)?.code ?? null,
          station_name: metaMap.get(g.station_id)?.name ?? null,
          severity: g.severity,
          gap_count: g.gap_count,
        }));
      }
    }

    // 5) HR Blockers: overdue required steps + blocked steps (org/site scope)
    let overdue_required_steps = 0;
    let blocked_steps = 0;
    const today = new Date().toISOString().slice(0, 10);
    const { data: esRows } = await supabaseAdmin
      .from("hr_employee_steps")
      .select("id, status, due_date, step_id")
      .eq("org_id", orgId)
      .in("status", ["pending", "blocked"]);
    const stepIds = [...new Set((esRows ?? []).map((r: { step_id: string }) => r.step_id))];
    const requiredByStep = new Map<string, boolean>();
    if (stepIds.length > 0) {
      const { data: stepMeta } = await supabaseAdmin
        .from("hr_workflow_steps")
        .select("id, required")
        .in("id", stepIds);
      for (const s of stepMeta ?? []) {
        const row = s as { id: string; required: boolean };
        requiredByStep.set(row.id, row.required === true);
      }
    }
    for (const r of esRows ?? []) {
      const row = r as { status: string; due_date: string | null; step_id: string };
      if (row.status === "blocked") blocked_steps += 1;
      else if (requiredByStep.get(row.step_id) && row.due_date != null && row.due_date < today) {
        overdue_required_steps += 1;
      }
    }
    const hr_blockers: HrBlockers = { overdue_required_steps, blocked_steps };

    const res = NextResponse.json({
      ok: true,
      production_readiness,
      legal_readiness,
      critical_gaps,
      hr_blockers,
      no_data: total_stations === 0,
    } satisfies CockpitSummaryV2Response);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/summary-v2]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summary failed" },
      { status: 500 }
    );
  }
}
