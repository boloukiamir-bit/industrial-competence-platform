import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { aggregateStationCompliance } from "@/lib/compliance/evaluate";
import { fetchCockpitIssues, normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";
import { getRosterEmployeeIdsForStationShift } from "@/lib/server/getRosterEmployeeIdsForStationShift";

type ReadinessStatus = "GREEN" | "AMBER" | "RED";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function normalizeDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function statusFromScore(score: number, greenAt = 85, amberAt = 60): ReadinessStatus {
  if (score >= greenAt) return "GREEN";
  if (score >= amberAt) return "AMBER";
  return "RED";
}

function percent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ ok: true, hasActiveOrg: false }, { status: 200 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = request.nextUrl;
  const date = normalizeDate(searchParams.get("date"));
  const shiftCodeParam = searchParams.get("shift_code")?.trim() || undefined;
  const shiftParam = searchParams.get("shift")?.trim() || undefined;
  const normalizedShift = normalizeShiftParam(shiftCodeParam, shiftParam);
  const shiftCode = normalizedShift ?? "all";
  const lineParam = searchParams.get("line")?.trim() || undefined;
  const lineFilter = lineParam && lineParam !== "all" ? lineParam : undefined;
  const includeDebug = process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1";
  const orgId = org.activeOrgId;
  const activeSiteId = org.activeSiteId ?? null;

  try {
    const [
      stationsRes,
      employeesRes,
      skillsRes,
      reqCountRes,
      ratingCountRes,
      reqStationsRes,
      eligibleStationsRes,
      complianceCatalogRes,
      complianceStatusRes,
      complianceBlockersRes,
      demandRes,
    ] = await Promise.all([
      supabaseAdmin.from("stations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true),
      supabaseAdmin.from("employees").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true),
      supabaseAdmin.from("skills").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabaseAdmin.from("station_skill_requirements").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabaseAdmin.from("employee_skill_ratings").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabaseAdmin.from("station_skill_requirements").select("station_id").eq("org_id", orgId),
      supabaseAdmin.from("v_station_coverage_status").select("station_id").eq("org_id", orgId).eq("status", "GO"),
      supabaseAdmin.from("compliance_catalog").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true),
      supabaseAdmin.from("v_employee_compliance_status").select("employee_id, status").eq("org_id", orgId),
      supabaseAdmin.from("v_employee_compliance_blockers_pilot").select("employee_id").eq("org_id", orgId),
      supabaseAdmin.from("pl_machine_demand").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    ]);

    const errors = [
      stationsRes.error && `stations: ${stationsRes.error.message}`,
      employeesRes.error && `employees: ${employeesRes.error.message}`,
      skillsRes.error && `skills: ${skillsRes.error.message}`,
      reqCountRes.error && `station_skill_requirements: ${reqCountRes.error.message}`,
      ratingCountRes.error && `employee_skill_ratings: ${ratingCountRes.error.message}`,
      reqStationsRes.error && `station_skill_requirements list: ${reqStationsRes.error.message}`,
      eligibleStationsRes.error && `v_station_coverage_status: ${eligibleStationsRes.error.message}`,
      complianceCatalogRes.error && `compliance_catalog: ${complianceCatalogRes.error.message}`,
      complianceStatusRes.error && `v_employee_compliance_status: ${complianceStatusRes.error.message}`,
      complianceBlockersRes.error &&
        `v_employee_compliance_blockers_pilot: ${complianceBlockersRes.error.message}`,
      demandRes.error && `pl_machine_demand: ${demandRes.error.message}`,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("[api/setup/readiness] query errors:", errors);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load readiness data", details: errors },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stationsCount = stationsRes.count ?? 0;
    const employeesCount = employeesRes.count ?? 0;
    const skillsCount = skillsRes.count ?? 0;
    const requirementsCount = reqCountRes.count ?? 0;
    const ratingsCount = ratingCountRes.count ?? 0;

    const stationsWithRequirements = new Set(
      (reqStationsRes.data ?? []).map((r) => (r as { station_id?: string | null }).station_id).filter(Boolean)
    ).size;
    const stationsWithEligibleOperator = new Set(
      (eligibleStationsRes.data ?? []).map((r) => (r as { station_id?: string | null }).station_id).filter(Boolean)
    ).size;

    const stationRequirementCoveragePct = percent(stationsWithRequirements, stationsCount);
    const stationEligibilityCoveragePct = percent(stationsWithEligibleOperator, stationsCount);
    const requirementsCoveragePercent = stationRequirementCoveragePct;
    const eligibleCoveragePercent = stationEligibilityCoveragePct;
    const coverageScore = stationsCount > 0
      ? Math.round((stationRequirementCoveragePct + stationEligibilityCoveragePct) / 2)
      : 0;

    const complianceCatalogCount = complianceCatalogRes.count ?? 0;
    const complianceRows = (complianceStatusRes.data ?? []) as Array<{ employee_id?: string | null; status?: string | null }>;
    const invalidEmployees = new Set<string>();

    for (const row of complianceRows) {
      const employeeId = row.employee_id ?? null;
      if (!employeeId) continue;
      const status = (row.status ?? "").toUpperCase();
      if (status !== "VALID") invalidEmployees.add(employeeId);
    }

    const validEmployeesCount =
      complianceCatalogCount > 0 && employeesCount > 0
        ? Math.max(0, employeesCount - invalidEmployees.size)
        : 0;
    const validCompliancePercent =
      complianceCatalogCount > 0 && employeesCount > 0 ? percent(validEmployeesCount, employeesCount) : 0;
    const legalBlockerEmployees = new Set(
      (complianceBlockersRes.data ?? [])
        .map((r) => (r as { employee_id?: string | null }).employee_id)
        .filter(Boolean)
    );
    const legalBlockersEmployeeCount =
      complianceCatalogCount > 0 && employeesCount > 0 ? legalBlockerEmployees.size : 0;

    const complianceScore = complianceCatalogCount > 0 ? validCompliancePercent : 0;

    const { issues } = await fetchCockpitIssues({
      org_id: orgId,
      site_id: activeSiteId,
      date,
      shift_code: shiftCode,
      line: lineFilter,
      include_go: false,
      show_resolved: false,
      debug: false,
    });
    const openIssues = issues.filter((i) => !i.resolved);
    const stationShiftMap = new Map<string, { stationId: string; shiftCode: string }>();
    for (const issue of openIssues) {
      if (!issue.station_id || !issue.shift_code) continue;
      const key = `${issue.station_id}:${issue.shift_code}`;
      if (!stationShiftMap.has(key)) {
        stationShiftMap.set(key, { stationId: issue.station_id, shiftCode: issue.shift_code });
      }
    }

    let legalBlockersCount = 0;
    let complianceBlockerItems = 0;
    let rosterEmployeeIdsTotal = 0;

    for (const entry of stationShiftMap.values()) {
      try {
        const rosterEmployeeIds = await getRosterEmployeeIdsForStationShift(
          supabaseAdmin,
          orgId,
          activeSiteId,
          entry.stationId,
          entry.shiftCode
        );
        rosterEmployeeIdsTotal += rosterEmployeeIds.length;
        if (rosterEmployeeIds.length === 0) continue;
        const agg = await aggregateStationCompliance(
          supabaseAdmin,
          {
            org_id: orgId,
            site_id: activeSiteId,
            shift_code: entry.shiftCode,
            station_id: entry.stationId,
          },
          rosterEmployeeIds
        );
        if (agg.compliance_blockers.length > 0) {
          legalBlockersCount += 1;
          complianceBlockerItems += agg.compliance_blockers.length;
        }
      } catch (err) {
        console.error("[api/setup/readiness] compliance blockers check failed:", err);
      }
    }

    const complianceStatus =
      complianceCatalogCount === 0
        ? "RED"
        : legalBlockersEmployeeCount === 0 && validCompliancePercent >= 95
          ? "GREEN"
          : validCompliancePercent >= 80
            ? "AMBER"
            : "RED";

    const gapsGeneratedCount = demandRes.count ?? 0;
    const gapsGenerated = gapsGeneratedCount > 0;
    const operationalIllegalCount = legalBlockersCount;
    const operationalScore = (gapsGenerated ? 50 : 0) + (operationalIllegalCount === 0 ? 50 : 0);
    const operationalStatus: ReadinessStatus =
      gapsGenerated && operationalIllegalCount === 0
        ? "GREEN"
        : gapsGenerated || operationalIllegalCount === 0
          ? "AMBER"
          : "RED";

    const foundationChecks = [
      stationsCount > 0,
      employeesCount > 0,
      skillsCount > 0,
      requirementsCount > 0,
      ratingsCount > 0,
    ];
    const foundationMet = foundationChecks.filter(Boolean).length;
    const foundationScore = Math.round((foundationMet / foundationChecks.length) * 100);
    const foundationStatus: ReadinessStatus =
      foundationMet === foundationChecks.length ? "GREEN" : foundationMet === 0 ? "RED" : "AMBER";

    const coverageStatus = statusFromScore(coverageScore);

    const weights = {
      foundation: 0.25,
      coverage: 0.25,
      compliance: 0.25,
      operational: 0.25,
    };
    const overallScore = Math.round(
      foundationScore * weights.foundation +
        coverageScore * weights.coverage +
        complianceScore * weights.compliance +
        operationalScore * weights.operational
    );
    const overallStatus = statusFromScore(overallScore);

    const debugPayload = includeDebug
      ? {
          filters: {
            date,
            shift_code: shiftCode,
            line: lineFilter ?? "all",
            site_id: activeSiteId,
          },
          sources: {
            stations: { table: "stations", count: stationsCount },
            requirements: {
              table: "station_skill_requirements",
              rows: (reqStationsRes.data ?? []).length,
              stations_with_requirements: stationsWithRequirements,
            },
            eligibility: {
              view: "v_station_coverage_status",
              go_rows: (eligibleStationsRes.data ?? []).length,
              stations_with_eligible_operator: stationsWithEligibleOperator,
            },
            compliance_status: {
              view: "v_employee_compliance_status",
              rows: complianceRows.length,
              employees_with_blockers: legalBlockersEmployeeCount,
              blockers_view: "v_employee_compliance_blockers_pilot",
              blockers_rows: (complianceBlockersRes.data ?? []).length,
            },
            cockpit_issues: {
              view: "v_cockpit_station_summary",
              issues_count: issues.length,
              open_issues_count: openIssues.length,
              station_shift_count: stationShiftMap.size,
            },
            legal_blockers: {
              source: "aggregateStationCompliance + v_roster_station_shift_drilldown_pilot",
              station_shifts_with_blockers: legalBlockersCount,
              roster_employee_ids_total: rosterEmployeeIdsTotal,
              compliance_blocker_items_total: complianceBlockerItems,
            },
          },
        }
      : undefined;

    const res = NextResponse.json({
      ok: true,
      hasActiveOrg: true,
      date,
      readiness: {
        foundation: {
          status: foundationStatus,
          score: foundationScore,
          stations: stationsCount,
          employees: employeesCount,
          skills: skillsCount,
          requirements: requirementsCount,
          ratings: ratingsCount,
        },
        coverage: {
          status: coverageStatus,
          score: coverageScore,
          totalStations: stationsCount,
          stationsWithRequirements,
          stationsWithEligible: stationsWithEligibleOperator,
          stationsWithEligibleOperator,
          station_requirement_coverage_pct: stationRequirementCoveragePct,
          station_eligibility_coverage_pct: stationEligibilityCoveragePct,
          requirementsCoveragePercent,
          eligibleCoveragePercent,
        },
        compliance: {
          status: complianceStatus,
          score: complianceScore,
          catalogCount: complianceCatalogCount,
          totalEmployees: employeesCount,
          validEmployees: validEmployeesCount,
          validPercent: validCompliancePercent,
          legalBlockers: legalBlockersEmployeeCount,
        },
        operational: {
          status: operationalStatus,
          score: operationalScore,
          gapsGenerated,
          gapsGeneratedCount,
          illegalIssuesCount: operationalIllegalCount,
          operationalIllegalCount,
        },
        overall: {
          status: overallStatus,
          score: overallScore,
        },
      },
      ...(includeDebug && debugPayload ? { debug: debugPayload } : {}),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/setup/readiness] unexpected error:", err);
    const res = NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load readiness" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
