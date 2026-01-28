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
  const startDate = searchParams.get("startDate") || new Date().toISOString().split("T")[0];
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
      console.log("[DEV line-overview/week]", { requestId, orgId: activeOrgId, query: "stations,pl_machines,pl_machine_demand,pl_assignment_segments,shift_rules" });
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

    const dates: string[] = [];
    const start = new Date(startDate);
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const machinesQuery =
      stationLines.length > 0
        ? supabaseAdmin.from("pl_machines").select("*").eq("org_id", activeOrgId).in("line_code", stationLines).order("machine_code")
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });
    const [machinesRes, demandRes, assignmentsRes, shiftRulesRes] = await Promise.all([
      machinesQuery,
      supabaseAdmin.from("pl_machine_demand").select("*").eq("org_id", activeOrgId).in("plan_date", dates).eq("shift_type", shift),
      supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", activeOrgId).in("plan_date", dates).eq("shift_type", shift),
      supabaseAdmin.from("shift_rules").select("shift_start,shift_end,break_minutes,paid_break_minutes").eq("org_id", activeOrgId).eq("shift_type", shift).maybeSingle(),
    ]);

    if (machinesRes.error) throw machinesRes.error;
    if (demandRes.error) throw demandRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const machines = machinesRes.data || [];
    const demands = demandRes.data || [];
    const assignments = assignmentsRes.data || [];
    const shiftRule = (shiftRulesRes.error ? null : shiftRulesRes.data) as ShiftRule | null;
    const netFactor = computeNetFactor(shiftRule);

    let totalRequired = 0;
    let totalAssigned = 0;

    const lineData = stationLines.map((lineCode) => {
      const lineMachines = machines.filter((m) => m.line_code === lineCode);

      const machineData = lineMachines.map((machine) => {
        const machineDemands = demands.filter((d) => d.machine_code === machine.machine_code);
        const machineAssigns = assignments.filter((a) => a.machine_code === machine.machine_code);

        const requiredHours = machineDemands.reduce((sum, d) => sum + (d.required_hours || 0), 0);
        let assignedHours = 0;

        machineAssigns.forEach((a) => {
          assignedHours += segmentNetHours(a.start_time, a.end_time, netFactor);
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
            id: machine.id,
            machineCode: machine.machine_code,
            machineName: machine.machine_name,
            lineCode: machine.line_code,
          },
          requiredHours,
          assignedHours,
          gap,
          status,
          assignedPeople: [],
        };
      });

      return {
        line: {
          id: lineCode,
          lineCode,
          lineName: lineCode,
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
    console.error("Week overview fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch week data" }, { status: 500 });
  }
}
