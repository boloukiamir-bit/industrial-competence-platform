import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_ORG_ID = "f607f244-da91-41d9-a648-d02a1591105c";

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
    const dates: string[] = [];
    const start = new Date(startDate);
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const [linesRes, machinesRes, demandRes, assignmentsRes] = await Promise.all([
      supabaseAdmin.from("pl_lines").select("*").eq("org_id", DEMO_ORG_ID).order("line_code"),
      supabaseAdmin.from("pl_machines").select("*").eq("org_id", DEMO_ORG_ID).order("machine_code"),
      supabaseAdmin.from("pl_machine_demand").select("*").eq("org_id", DEMO_ORG_ID).in("plan_date", dates).eq("shift_type", shift),
      supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", DEMO_ORG_ID).in("plan_date", dates).eq("shift_type", shift),
    ]);

    if (linesRes.error) throw linesRes.error;
    if (machinesRes.error) throw machinesRes.error;
    if (demandRes.error) throw demandRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const lines = linesRes.data || [];
    const machines = machinesRes.data || [];
    const demands = demandRes.data || [];
    const assignments = assignmentsRes.data || [];

    let totalRequired = 0;
    let totalAssigned = 0;

    const lineData = lines.map((line) => {
      const lineMachines = machines.filter((m) => m.line_code === line.line_code);

      const machineData = lineMachines.map((machine) => {
        const machineDemands = demands.filter((d) => d.machine_code === machine.machine_code);
        const machineAssigns = assignments.filter((a) => a.machine_code === machine.machine_code);

        const requiredHours = machineDemands.reduce((sum, d) => sum + (d.required_hours || 0), 0);
        let assignedHours = 0;

        machineAssigns.forEach((a) => {
          const start = new Date(`2000-01-01T${a.start_time}`);
          const end = new Date(`2000-01-01T${a.end_time}`);
          assignedHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
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
          id: line.id,
          lineCode: line.line_code,
          lineName: line.line_name,
        },
        machines: machineData,
        totalRequired: machineData.reduce((sum, m) => sum + m.requiredHours, 0),
        totalAssigned: machineData.reduce((sum, m) => sum + m.assignedHours, 0),
        totalGap: machineData.reduce((sum, m) => sum + Math.max(0, m.gap), 0),
      };
    });

    const coveragePercent = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100;

    return NextResponse.json({
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
  } catch (error) {
    console.error("Week overview fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch week data" }, { status: 500 });
  }
}
