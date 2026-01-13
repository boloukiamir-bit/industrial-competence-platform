import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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

const suggestionsSchema = z.object({
  machineCode: z.string(),
  date: z.string(),
  shift: z.string(),
  hoursNeeded: z.number().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = suggestionsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const { date, shift, hoursNeeded } = parsed.data;
    const shiftType = shiftParamToDbValue(shift);

    const [employeesRes, attendanceRes, assignmentsRes] = await Promise.all([
      supabaseAdmin.from("pl_employees").select("*").eq("org_id", DEMO_ORG_ID),
      supabaseAdmin.from("pl_attendance").select("*").eq("org_id", DEMO_ORG_ID).eq("plan_date", date).eq("shift_type", shiftType),
      supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", DEMO_ORG_ID).eq("plan_date", date).eq("shift_type", shiftType),
    ]);

    if (employeesRes.error) throw employeesRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const employees = employeesRes.data || [];
    const attendance = attendanceRes.data || [];
    const assignments = assignmentsRes.data || [];

    const attendanceMap = new Map(attendance.map((a) => [a.employee_code, a]));

    const suggestions = employees
      .filter((emp) => {
        const att = attendanceMap.get(emp.employee_code);
        return !att || att.status === "present";
      })
      .map((emp) => {
        const empAssignments = assignments.filter((a) => a.employee_code === emp.employee_code);
        let currentHours = 0;
        empAssignments.forEach((a) => {
          const start = new Date(`2000-01-01T${a.start_time}`);
          const end = new Date(`2000-01-01T${a.end_time}`);
          currentHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        });

        const score = 100 - (currentHours / 8) * 50;
        const availableHours = Math.max(0, 8 - currentHours);

        return {
          employee: {
            id: emp.id,
            employeeCode: emp.employee_code,
            fullName: emp.full_name,
          },
          currentHours,
          availableHours,
          score,
        };
      })
      .filter((s) => s.availableHours > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
