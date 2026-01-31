import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getRequestId } from "@/lib/server/requestId";
import { segmentGrossHours } from "@/lib/lineOverviewNet";
import { getLineName } from "@/lib/lineOverviewLineNames";
import { normalizeShift } from "@/lib/shift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type StationRow = { id: string; name: string | null; code: string | null; line: string | null };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || new Date().toISOString().split("T")[0];
  const shiftRaw = searchParams.get("shift");
  const shift = normalizeShift(shiftRaw ?? "Day");
  
  if (!shift) {
    return NextResponse.json(
      { ok: false, error: "Invalid shift parameter", step: "validation", details: { shift: shiftRaw } },
      { status: 400 }
    );
  }

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

    if (process.env.NODE_ENV !== "production") {
      const requestId = getRequestId(request);
      console.log("[DEV line-overview/week]", { requestId, orgId: activeOrgId, query: "stations,pl_machine_demand,pl_assignment_segments" });
    }

    const { data: stationsRows, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("id, name, code, line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null)
      .order("line")
      .order("name");

    if (stationsError) {
      console.error("[line-overview/week] stations query error:", stationsError);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch stations", step: "stations", details: stationsError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stations = (stationsRows || []) as StationRow[];
    const stationLines = [...new Set(stations.map((s) => s.line).filter((v): v is string => Boolean(v)))].sort();

    const dates: string[] = [];
    const start = new Date(startDate);
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const { data: shiftRows, error: shiftsError } = await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", activeOrgId)
      .in("shift_date", dates)
      .eq("shift_type", shift);

    if (shiftsError) throw shiftsError;
    const shiftIds = (shiftRows || []).map((r: { id: string }) => r.id);

    const [demandRes, assignmentsRes] = await Promise.all([
      supabaseAdmin.from("pl_machine_demand").select("*").eq("org_id", activeOrgId).in("plan_date", dates).eq("shift_type", shift),
      shiftIds.length > 0
        ? supabaseAdmin
            .from("shift_assignments")
            .select(`
              id,
              assignment_date,
              shift:shift_id(shift_date, shift_type, line),
              station:station_id(id, code, name),
              employee:employee_id(id, employee_number, name)
            `)
            .eq("org_id", activeOrgId)
            .in("shift_id", shiftIds)
        : { data: [], error: null },
    ]);

    if (demandRes.error) throw demandRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const demands = demandRes.data || [];
    const rawAssignments = assignmentsRes.data || [];

    type WeekAssignmentShape = { id: string; station_id?: string; machine_code?: string; start_time: string; end_time: string };
    const DEFAULT_START = "06:00";
    const DEFAULT_END = "14:00";

    const assignments: WeekAssignmentShape[] = rawAssignments.map((a: {
      id: string;
      station?: { id?: string; code?: string } | null;
    }) => {
      const station = a.station;
      const stationId = station?.id ?? "";
      const machineCode = (station?.code ?? stationId) || "";
      return {
        id: a.id,
        station_id: stationId,
        machine_code: machineCode,
        start_time: DEFAULT_START,
        end_time: DEFAULT_END,
      } as WeekAssignmentShape;
    });

    const demandByStationId = new Map<string, { required_hours?: number }[]>();
    const demandByMachineCode = new Map<string, { required_hours?: number }[]>();
    for (const d of demands as Array<{ station_id?: string; machine_code?: string; required_hours?: number }>) {
      if (d.station_id) {
        const list = demandByStationId.get(d.station_id) || [];
        list.push(d);
        demandByStationId.set(d.station_id, list);
      }
      if (d.machine_code) {
        const list = demandByMachineCode.get(d.machine_code) || [];
        list.push(d);
        demandByMachineCode.set(d.machine_code, list);
      }
    }
    const assignmentsByStationId = new Map<string, WeekAssignmentShape[]>();
    const assignmentsByMachineCode = new Map<string, WeekAssignmentShape[]>();
    for (const a of assignments) {
      if (a.station_id) {
        const list = assignmentsByStationId.get(a.station_id) || [];
        list.push(a);
        assignmentsByStationId.set(a.station_id, list);
      }
      if (a.machine_code) {
        const list = assignmentsByMachineCode.get(a.machine_code) || [];
        list.push(a);
        assignmentsByMachineCode.set(a.machine_code, list);
      }
    }

    let totalRequired = 0;
    let totalAssigned = 0;

    const lineData = stationLines.map((lineCode) => {
      const lineStations = stations.filter((s) => s.line === lineCode);

      const machineData = lineStations.map((station) => {
        const stationCode = station.code ?? station.id;
        const machineDemands = demandByStationId.get(station.id) ?? demandByMachineCode.get(stationCode) ?? [];
        const machineAssigns = assignmentsByStationId.get(station.id) ?? assignmentsByMachineCode.get(stationCode) ?? [];

        const requiredHours = machineDemands.reduce((sum, d) => sum + (d.required_hours || 0), 0);
        let assignedHours = 0;
        machineAssigns.forEach((a: WeekAssignmentShape) => {
          assignedHours += segmentGrossHours(a.start_time, a.end_time);
        });

        const gap = requiredHours - assignedHours;
        totalRequired += requiredHours;
        totalAssigned += assignedHours;

        let status: "ok" | "partial" | "gap" = "ok";
        if (requiredHours > 0) {
          if (assignedHours === 0) status = "gap";
          else if (assignedHours < requiredHours) status = "partial";
        }

        return {
          machine: {
            id: station.id,
            stationId: station.id,
            stationCode,
            stationName: station.name ?? station.code ?? stationCode,
            machineCode: stationCode,
            machineName: station.name ?? station.code ?? stationCode,
            lineCode,
          },
          requiredHours,
          assignedHours,
          gap,
          status,
          assignedPeople: [] as Array<{ employeeCode: string; employeeName: string; startTime: string; endTime: string }>,
        };
      });

      return {
        line: {
          id: lineCode,
          lineCode,
          lineName: getLineName(lineCode),
        },
        machines: machineData,
        totalRequired: machineData.reduce((sum, m) => sum + m.requiredHours, 0),
        totalAssigned: machineData.reduce((sum, m) => sum + m.assignedHours, 0),
        totalGap: machineData.reduce((sum, m) => sum + Math.max(0, m.gap), 0),
      };
    });

    const coveragePercent = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100;

    const res = NextResponse.json({
      lines: lineData,
      kpis: {
        coveragePercent,
        gapHours: Math.max(0, totalRequired - totalAssigned),
        overtimeHours: 0,
        presentCount: 0,
        absentCount: 0,
      },
      employees: [],
      weekDates: dates,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[line-overview/week] fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch week data";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}
