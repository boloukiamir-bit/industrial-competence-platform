import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getRequestId } from "@/lib/server/requestId";
import {
  computeNetFactor,
  segmentNetHours,
  type ShiftRule,
} from "@/lib/lineOverviewNet";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function shiftParamToDbValue(shift: string): string {
  const map: Record<string, string> = {
    day: "Day",
    evening: "Evening",
    night: "Night",
  };
  return map[shift.toLowerCase()] || "Day";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const shift = shiftParamToDbValue(searchParams.get("shift") || "day");

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;

    if (process.env.NODE_ENV !== "production") {
      const requestId = getRequestId(request);
      console.log("[DEV line-overview]", { requestId, orgId: activeOrgId, query: "stations,pl_machines,pl_machine_demand,pl_assignment_segments,pl_attendance,pl_employees,shift_rules" });
    }

    const { data: stations, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null);

    if (stationsError) {
      const res = NextResponse.json({ error: "Failed to fetch lines" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stationLines = [...new Set((stations || []).map((s: { line?: string }) => s.line).filter((v): v is string => Boolean(v)))].sort();

    const machinesQuery =
      stationLines.length > 0
        ? supabaseAdmin.from("pl_machines").select("*").eq("org_id", activeOrgId).in("line_code", stationLines).order("machine_code")
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });
    const [machinesRes, demandRes, assignmentsRes, attendanceRes, employeesRes, shiftRulesRes] =
      await Promise.all([
        machinesQuery,
        supabaseAdmin.from("pl_machine_demand").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shift),
        supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shift),
        supabaseAdmin.from("pl_attendance").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shift),
        supabaseAdmin.from("pl_employees").select("*").eq("org_id", activeOrgId),
        supabaseAdmin.from("shift_rules").select("shift_start,shift_end,break_minutes,paid_break_minutes").eq("org_id", activeOrgId).eq("shift_type", shift).maybeSingle(),
      ]);

    if (machinesRes.error) throw machinesRes.error;
    if (demandRes.error) throw demandRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (employeesRes.error) throw employeesRes.error;

    const machines = machinesRes.data || [];
    const demands = demandRes.data || [];
    const assignments = assignmentsRes.data || [];
    const attendance = attendanceRes.data || [];
    const employees = employeesRes.data || [];
    const shiftRule = (shiftRulesRes.error ? null : shiftRulesRes.data) as ShiftRule | null;
    const netFactor = computeNetFactor(shiftRule);

    const demandMap = new Map(demands.map((d) => [d.machine_code, d]));
    const employeeMap = new Map(employees.map((e) => [e.employee_code, e]));

    const assignmentsByMachine = new Map<string, typeof assignments>();
    assignments.forEach((a) => {
      const list = assignmentsByMachine.get(a.machine_code) || [];
      list.push(a);
      assignmentsByMachine.set(a.machine_code, list);
    });

    const presentCount = attendance.filter((a) => a.status === "present").length;
    const partialCount = attendance.filter((a) => a.status === "partial").length;
    const absentCount = attendance.filter((a) => a.status === "absent").length;

    let totalRequired = 0;
    let totalAssigned = 0;
    let totalGap = 0;
    let totalOverAssigned = 0;

    const lineData = stationLines.map((lineCode) => {
      const lineMachines = machines.filter((m) => m.line_code === lineCode);

      const machineData = lineMachines.map((machine) => {
        const demand = demandMap.get(machine.machine_code);
        const machineAssignments = assignmentsByMachine.get(machine.machine_code) || [];

        const requiredHours = demand?.required_hours || 0;
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

        machineAssignments.forEach((a) => {
          const hours = segmentNetHours(a.start_time, a.end_time, netFactor);
          assignedHours += hours;

          const emp = employeeMap.get(a.employee_code);
          if (emp) {
            assignedPeople.push({
              assignmentId: a.id,
              employeeId: emp.id,
              employeeCode: emp.employee_code,
              employeeName: emp.full_name,
              startTime: a.start_time,
              endTime: a.end_time,
              hours,
            });
          }
        });

        const gap = requiredHours - assignedHours;
        const overAssigned = assignedHours > requiredHours ? assignedHours - requiredHours : 0;
        totalRequired += requiredHours;
        totalAssigned += assignedHours;
        if (gap > 0) totalGap += gap;
        if (overAssigned > 0) totalOverAssigned += overAssigned;

        let status: "ok" | "partial" | "gap" | "over" | "no_demand" = "no_demand";
        if (requiredHours > 0) {
          if (assignedHours === 0) status = "gap";
          else if (assignedHours < requiredHours) status = "partial";
          else if (assignedHours > requiredHours) status = "over";
          else status = "ok";
        } else if (assignedHours > 0) {
          status = "over";
        }

        const assignmentsOut = machineAssignments.map((a) => ({
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
            id: machine.id,
            machineCode: machine.machine_code,
            machineName: machine.machine_name,
            lineCode: machine.line_code,
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

      const lineRequired = machineData.reduce((sum, m) => sum + m.requiredHours, 0);
      const lineAssigned = machineData.reduce((sum, m) => sum + m.assignedHours, 0);
      const lineGap = machineData.reduce((sum, m) => sum + Math.max(0, m.gap), 0);
      const lineOverAssigned = machineData.reduce((sum, m) => sum + m.overAssigned, 0);

      return {
        line: {
          id: lineCode,
          lineCode,
          lineName: lineCode,
        },
        machines: machineData,
        totalRequired: lineRequired,
        totalAssigned: lineAssigned,
        totalGap: lineGap,
        totalOverAssigned: lineOverAssigned,
      };
    });

    const hasDemand = totalRequired > 0;
    const coveragePercent = hasDemand ? Math.min(Math.round((totalAssigned / totalRequired) * 100), 999) : null;

    const res = NextResponse.json({
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
      employees: employees.map((e) => ({
        id: e.id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
      })),
      attendance: attendance.map((a) => ({
        id: a.id,
        employeeCode: a.employee_code,
        planDate: a.plan_date,
        shiftType: a.shift_type,
        status: a.status,
        availableFrom: a.available_from,
        availableTo: a.available_to,
        note: a.note,
      })),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Line overview fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
