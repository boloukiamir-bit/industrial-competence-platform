import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getRequestId } from "@/lib/server/requestId";
import { normalizeShift } from "@/lib/shift";
import { segmentGrossHours } from "@/lib/lineOverviewNet";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";
import { getLineName } from "@/lib/lineOverviewLineNames";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type StationRow = { id: string; name: string | null; code: string | null; line: string | null };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
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
    const activeSiteId = org.activeSiteId ?? null;

    const { data: stationsRows, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("id, name, code, line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null)
      .order("line")
      .order("name");

    if (stationsError) {
      console.error("[line-overview] stations query error:", stationsError);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch stations", step: "stations", details: stationsError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stations = (stationsRows || []) as StationRow[];
    const stationLines = [...new Set(stations.map((s) => s.line).filter((v): v is string => Boolean(v)))].sort();

    let employeesQuery = employeesBaseQuery(supabaseAdmin, activeOrgId, "id, employee_number, name");
    if (activeSiteId) {
      employeesQuery = employeesQuery.eq("site_id", activeSiteId);
    }

    const { data: shiftRows, error: shiftsError } = await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("shift_date", date)
      .eq("shift_type", shift);

    if (shiftsError) throw shiftsError;
    const shiftIds = (shiftRows || []).map((r: { id: string }) => r.id);

    const [demandRes, assignmentsRes, attendanceRes, employeesRes] =
      await Promise.all([
        supabaseAdmin.from("pl_machine_demand").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shift),
        shiftIds.length > 0
          ? supabaseAdmin
              .from("shift_assignments")
              .select(`
                id,
                assignment_date,
                status,
                shift:shift_id(shift_date, shift_type, line),
                station:station_id(id, code, name),
                employee:employee_id(id, employee_number, name)
              `)
              .eq("org_id", activeOrgId)
              .in("shift_id", shiftIds)
          : { data: [], error: null },
        supabaseAdmin.from("pl_attendance").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shift),
        employeesQuery,
      ]);

    if (demandRes.error) throw demandRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (employeesRes.error) throw employeesRes.error;

    const demands = demandRes.data || [];
    const rawAssignments = assignmentsRes.data || [];
    const attendance = attendanceRes.data || [];
    const employees = (employeesRes.data || []) as unknown as Array<{
      id: string;
      employee_number: string;
      name: string;
    }>;
    const demandByStationId = new Map<string, number>();
    const demandByMachineCode = new Map<string, number>();
    for (const d of demands as Array<{ station_id?: string; machine_code?: string; required_hours?: number }>) {
      const required = Number(d.required_hours ?? 0) || 0;
      if (d.station_id) {
        demandByStationId.set(d.station_id, (demandByStationId.get(d.station_id) ?? 0) + required);
      } else if (d.machine_code) {
        demandByMachineCode.set(d.machine_code, (demandByMachineCode.get(d.machine_code) ?? 0) + required);
      }
    }
    const employeeMap = new Map(employees.map((e: { employee_number: string; id: string; name: string }) => [e.employee_number, e]));

    type AssignmentShape = {
      id: string;
      station_id?: string;
      machine_code?: string;
      employee_code?: string;
      employee_id?: string;
      employee_name?: string;
      start_time: string;
      end_time: string;
      plan_date?: string;
      shift_type?: string;
      role_note?: string;
    };

    const DEFAULT_START = "06:00";
    const DEFAULT_END = "14:00";

    const assignments: AssignmentShape[] = rawAssignments.map((a: {
      id: string;
      assignment_date?: string;
      status?: string;
      shift?: { shift_date?: string; shift_type?: string; line?: string } | null;
      station?: { id?: string; code?: string; name?: string } | null;
      employee?: { id?: string; employee_number?: string; name?: string } | null;
    }) => {
      const station = a.station;
      const employee = a.employee;
      const stationId = station?.id ?? "";
      const machineCode = (station?.code ?? stationId) || "";
      return {
        id: a.id,
        station_id: stationId,
        machine_code: machineCode,
        employee_code: employee?.employee_number ?? "",
        employee_id: employee?.id,
        employee_name: employee?.name ?? "",
        start_time: DEFAULT_START,
        end_time: DEFAULT_END,
        plan_date: a.assignment_date ?? a.shift?.shift_date,
        shift_type: a.shift?.shift_type ?? shift,
        role_note: a.status ?? null,
      } as AssignmentShape;
    });

    const assignmentsByStationId = new Map<string, AssignmentShape[]>();
    const assignmentsByMachineCode = new Map<string, AssignmentShape[]>();
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

    const presentCount = attendance.filter(
      (a: { status?: string }) => a.status === "present"
    ).length;
    const partialCount = attendance.filter(
      (a: { status?: string }) => a.status === "partial"
    ).length;
    const absentCount = attendance.filter(
      (a: { status?: string }) => a.status === "absent"
    ).length;

    let totalRequired = 0;
    let totalAssigned = 0;
    let totalGap = 0;
    let totalOverAssigned = 0;

    const lineData = stationLines.map((lineCode) => {
      const lineStations = stations.filter((s) => s.line === lineCode);
      const lineName = getLineName(lineCode ?? lineStations[0]?.line ?? "");

      const machineData = lineStations.map((station) => {
        const stationCode = station.code ?? station.id;
        const demandHours =
          demandByStationId.get(station.id) ?? demandByMachineCode.get(stationCode) ?? 0;
        const machineAssignments =
          assignmentsByStationId.get(station.id) ?? assignmentsByMachineCode.get(stationCode) ?? [];

        const requiredHours = Number(demandHours) || 0;
        let assignedHours = 0;
        const assignedPeople: Array<{
          assignmentId: string;
          employeeId: string;
          employeeCode: string;
          employeeName: string;
          startTime: string;
          endTime: string;
          hours: number;
        }> = [];

        machineAssignments.forEach((a: AssignmentShape) => {
          const hours = segmentGrossHours(a.start_time, a.end_time);
          assignedHours += hours;

          const emp = employeeMap.get(a.employee_code ?? "") as { id: string; employee_number: string; name: string } | undefined;
          assignedPeople.push({
            assignmentId: a.id,
            employeeId: emp?.id ?? a.employee_id ?? "",
            employeeCode: emp?.employee_number ?? a.employee_code ?? "",
            employeeName: emp?.name ?? a.employee_name ?? "",
            startTime: a.start_time,
            endTime: a.end_time,
            hours,
          });
        });

        const gap = Math.max(0, requiredHours - assignedHours);
        const overAssigned = Math.max(0, assignedHours - requiredHours);
        totalRequired += requiredHours;
        totalAssigned += assignedHours;
        totalGap += gap;
        totalOverAssigned += overAssigned;

        let status: "ok" | "partial" | "gap" | "over" | "no_demand" = "no_demand";
        if (requiredHours > 0) {
          if (assignedHours === 0) status = "gap";
          else if (assignedHours < requiredHours) status = "partial";
          else if (assignedHours > requiredHours) status = "over";
          else status = "ok";
        } else if (assignedHours > 0) {
          status = "over";
        }

        const assignmentsOut = machineAssignments.map((a: AssignmentShape) => ({
          id: a.id,
          planDate: a.plan_date,
          shiftType: a.shift_type,
          machineCode: a.machine_code,
          employeeCode: a.employee_code,
          startTime: a.start_time,
          endTime: a.end_time,
          roleNote: a.role_note,
        }));

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
          overAssigned,
          status,
          assignments: assignmentsOut,
          assignedPeople,
        };
      });

      const lineRequired = machineData.reduce(
        (sum: number, m: { requiredHours: number }) => sum + (Number(m.requiredHours) || 0),
        0
      );
      const lineAssigned = machineData.reduce(
        (sum: number, m: { assignedHours: number }) => sum + (Number(m.assignedHours) || 0),
        0
      );
      const lineGap = machineData.reduce(
        (sum: number, m: { gap: number }) => sum + (Number(m.gap) || 0),
        0
      );
      const lineOverAssigned = machineData.reduce(
        (sum: number, m: { overAssigned: number }) => sum + (Number(m.overAssigned) || 0),
        0
      );

      return {
        lineCode,
        lineName,
        machines: machineData,
        demandHours: lineRequired,
        assignedHours: lineAssigned,
        gapHours: lineGap,
        overAssignedHours: lineOverAssigned,
      };
    });

    const hasDemand = totalRequired > 0;
    const coveragePercent = hasDemand ? Math.min(Math.round((totalAssigned / totalRequired) * 100), 999) : null;

    if (process.env.NODE_ENV !== "production") {
      const requestId = getRequestId(request);
      const matchedDemandRows = demands.filter((d: { station_id?: string; machine_code?: string }) =>
        d.station_id ? demandByStationId.has(d.station_id) : d.machine_code ? demandByMachineCode.has(d.machine_code) : false
      ).length;
      console.log("[DEV line-overview summary]", {
        requestId,
        orgId: activeOrgId,
        date,
        shift,
        stations: stations.length,
        demandRows: demands.length,
        demandMatched: matchedDemandRows,
      });
    }

    const res = NextResponse.json({
      date,
      shiftType: shift,
      lines: lineData,
      kpis: {
        hasDemand,
        coveragePercent,
        gapHours: hasDemand ? totalGap : null,
        overAssignedHours: totalOverAssigned,
        presentCount,
        partialCount,
        absentCount,
      },
      employees: employees.map((e: { id: string; employee_number: string; name: string }) => ({
        id: e.id,
        employeeCode: e.employee_number,
        fullName: e.name,
      })),
      attendance: attendance.map(
        (a: {
          id: string;
          employee_code?: string;
          plan_date?: string;
          shift_type?: string;
          status?: string;
          available_from?: string;
          available_to?: string;
          note?: string;
        }) => ({
          id: a.id,
          employeeCode: a.employee_code,
          planDate: a.plan_date ?? date,
          shiftType: a.shift_type ?? shift,
          status: a.status,
          availableFrom: a.available_from,
          availableTo: a.available_to,
          note: a.note,
        })
      ),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[line-overview] fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch data";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}
