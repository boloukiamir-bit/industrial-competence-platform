import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { normalizeShift } from "@/lib/shift";
import { getEligibilityByLine } from "@/services/eligibilityService";
import { segmentGrossHours } from "@/lib/lineOverviewNet";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";
import { getLineName } from "@/lib/lineOverviewLineNames";
import { isPlaceholderStation } from "@/lib/server/lineToStation";

/** Max eligible operators in response list; eligibleOperatorsCount is always the full set size. */
export const ELIGIBLE_OPERATORS_LIST_LIMIT_DEFAULT = 20;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type RootCauseType = "CAPACITY" | "SKILLS" | "COVERAGE";

export type TomorrowsGapsStationRow = {
  stationId: string;
  stationCode: string;
  stationName: string;
  requiredHours: number;
  assignedHours: number;
  gapHours: number;
};

export type TomorrowsGapsLineRow = {
  lineCode: string;
  lineName: string;
  requiredHours: number;
  assignedHours: number;
  gapHours: number;
  competenceStatus: "NO-GO" | "WARNING" | "OK";
  eligibleOperatorsCount: number;
  requiredSkills: { code: string; name: string }[];
  eligibleOperators: { employee_number: string; name: string }[];
  resolved?: boolean;
  /** Root cause classification for decision center */
  root_cause?: {
    primary: RootCauseType;
    causes: RootCauseType[];
  };
  /** Per-station breakdown (gap hours per station) */
  stations: TomorrowsGapsStationRow[];
  /** Top 3 missing skill codes when no eligible operators (for SKILLS cause) */
  missing_skill_codes: string[];
  /** Recommended next action */
  recommended_action: "assign" | "call_in" | "swap";
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim() || new Date().toISOString().slice(0, 10);
  const shiftRaw = searchParams.get("shift_code") ?? searchParams.get("shift");
  const shift = normalizeShift(shiftRaw ?? "Day");
  
  if (!shift) {
    return NextResponse.json(
      { ok: false, error: "Invalid shift parameter", step: "validation", details: { shift: shiftRaw } },
      { status: 400 }
    );
  }
  const lineFilter = searchParams.get("line")?.trim() || null;

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error, step: "auth" },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const { data: stationsRows, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("id, name, code, line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null)
      .order("line")
      .order("name");

    if (stationsError) {
      console.error("[tomorrows-gaps] stations query error:", stationsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch stations", step: "stations", details: stationsError.message },
        { status: 500 }
      );
    }

    type StationRow = { id: string; name: string | null; code: string | null; line: string | null };
    const allStations = ((stationsRows || []) as StationRow[]).filter((s) => !isPlaceholderStation(s));
    let stationLines = [...new Set(allStations.map((s) => s.line).filter((v): v is string => Boolean(v)))].sort();
    if (lineFilter) {
      stationLines = stationLines.filter((l) => l === lineFilter);
    }

    if (stationLines.length === 0) {
      const res = NextResponse.json({ date, shift, lines: [] });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const [demandRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("pl_machine_demand")
        .select("*")
        .eq("org_id", activeOrgId)
        .eq("plan_date", date)
        .eq("shift_type", shift),
      supabaseAdmin
        .from("pl_assignment_segments")
        .select("*")
        .eq("org_id", activeOrgId)
        .eq("plan_date", date)
        .eq("shift_type", shift),
    ]);

    if (demandRes.error) throw demandRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const demands = demandRes.data || [];
    const assignments = assignmentsRes.data || [];

    const demandByStationId = new Map<string, { required_hours?: number }>();
    const demandByMachineCode = new Map<string, { required_hours?: number }>();
    for (const d of demands as Array<{ station_id?: string; machine_code?: string; required_hours?: number }>) {
      if (d.station_id) demandByStationId.set(d.station_id, d);
      if (d.machine_code) demandByMachineCode.set(d.machine_code, d);
    }

    type Seg = (typeof assignments)[number];
    const assignmentsByStationId = new Map<string, Seg[]>();
    const assignmentsByMachineCode = new Map<string, Seg[]>();
    for (const a of assignments as Array<{ station_id?: string; machine_code?: string; start_time?: string; end_time?: string; employee_code?: string }>) {
      if (a.station_id) {
        const list = assignmentsByStationId.get(a.station_id) || [];
        list.push(a as Seg);
        assignmentsByStationId.set(a.station_id, list);
      }
      if (a.machine_code) {
        const list = assignmentsByMachineCode.get(a.machine_code) || [];
        list.push(a as Seg);
        assignmentsByMachineCode.set(a.machine_code, list);
      }
    }

    const linesOut: TomorrowsGapsLineRow[] = [];
    const ELIGIBLE_THRESHOLD = 1;

    for (const lineCode of stationLines) {
      const lineStations = allStations.filter((s) => s.line === lineCode);
      const stationRows: TomorrowsGapsStationRow[] = [];
      let requiredHours = 0;
      let assignedHours = 0;
      const assignedEmployeeCodes = new Set<string>();

      for (const station of lineStations) {
        const demand = demandByStationId.get(station.id) ?? demandByMachineCode.get(station.code ?? station.id);
        const req = demand?.required_hours ?? 0;
        const segs = assignmentsByStationId.get(station.id) ?? assignmentsByMachineCode.get(station.code ?? station.id) ?? [];
        let stAssigned = 0;
        for (const a of segs) {
          const hours = segmentGrossHours((a as { start_time: string }).start_time, (a as { end_time: string }).end_time);
          stAssigned += hours;
          const ec = (a as { employee_code?: string }).employee_code;
          if (ec) assignedEmployeeCodes.add(ec);
        }
        requiredHours += req;
        assignedHours += stAssigned;
        const gapHours = Math.max(0, req - stAssigned);
        stationRows.push({
          stationId: station.id,
          stationCode: station.code ?? station.id,
          stationName: station.name ?? station.code ?? station.id,
          requiredHours: req,
          assignedHours: stAssigned,
          gapHours,
        });
      }

      const gapHours = Math.max(0, requiredHours - assignedHours);

      let eligibility = null;
      try {
        eligibility = await getEligibilityByLine(supabaseAdmin, activeOrgId, lineCode);
      } catch (err) {
        console.error("tomorrows-gaps: getEligibilityByLine failed for", lineCode, err);
      }

      const fullEligible = (eligibility?.employees || []).filter((e) => e.eligible);
      const totalEligible = fullEligible.length;
      const eligibleOperatorsCount = totalEligible;
      const eligibleSet = new Set(
        fullEligible.map((e) => e.employee_number ?? "")
      );
      const hasIneligibleAssigned = [...assignedEmployeeCodes].some((code) => !eligibleSet.has(code));

      let competenceStatus: "NO-GO" | "WARNING" | "OK" = "OK";
      if (hasIneligibleAssigned) {
        competenceStatus = "NO-GO";
      } else if (gapHours > 0 && eligibleOperatorsCount === 0) {
        competenceStatus = "NO-GO";
      } else if (gapHours > 0 && eligibleOperatorsCount > 0) {
        competenceStatus = "WARNING";
      } else {
        competenceStatus = "OK";
      }

      const requiredSkills = eligibility?.required_skills ?? [];
      const requiredSkillCodes = (eligibility as { required_skill_codes?: string[] })?.required_skill_codes ?? requiredSkills.map((s) => s.code);
      const eligibleOperators = fullEligible
        .slice(0, ELIGIBLE_OPERATORS_LIST_LIMIT_DEFAULT)
        .map((e) => ({ employee_number: e.employee_number ?? "", name: e.name ?? "" }));

      const causes: RootCauseType[] = [];
      if (gapHours > 0) causes.push("CAPACITY");
      if (requiredSkillCodes.length > 0 && eligibleOperatorsCount === 0) causes.push("SKILLS");
      if (eligibleOperatorsCount < ELIGIBLE_THRESHOLD && (gapHours > 0 || requiredSkillCodes.length > 0)) causes.push("COVERAGE");
      const primary: RootCauseType = causes[0] ?? "CAPACITY";
      const missing_skill_codes = requiredSkillCodes.length > 0 && eligibleOperatorsCount === 0
        ? requiredSkillCodes.slice(0, 3)
        : [];
      let recommended_action: "assign" | "call_in" | "swap" = "assign";
      if (primary === "COVERAGE" || (primary === "CAPACITY" && eligibleOperatorsCount === 0)) recommended_action = "call_in";
      else if (primary === "SKILLS" && eligibleOperatorsCount > 0) recommended_action = "swap";

      linesOut.push({
        lineCode,
        lineName: getLineName(lineCode),
        requiredHours,
        assignedHours,
        gapHours,
        competenceStatus,
        eligibleOperatorsCount,
        requiredSkills,
        eligibleOperators,
        root_cause: { primary, causes },
        stations: stationRows,
        missing_skill_codes,
        recommended_action,
      });
    }

    const targetIds = linesOut.map((row) => lineShiftTargetId(date, shift, row.lineCode));
    const { data: edRows } = await supabaseAdmin
      .from("execution_decisions")
      .select("target_id")
      .eq("org_id", activeOrgId)
      .eq("decision_type", "resolve_no_go")
      .eq("target_type", "line_shift")
      .eq("status", "active")
      .in("target_id", targetIds);

    const resolvedTargetIds = new Set(
      (edRows || []).map((r: { target_id: string }) => r.target_id)
    );
    linesOut.forEach((row) => {
      row.resolved = resolvedTargetIds.has(lineShiftTargetId(date, shift, row.lineCode));
    });

    const res = NextResponse.json({
      date,
      shift,
      lines: linesOut,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[tomorrows-gaps] fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}
