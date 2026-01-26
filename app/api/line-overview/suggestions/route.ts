import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

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

    if (stationLines.length === 0) {
      const res = NextResponse.json({ suggestions: [] });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json();
    const parsed = suggestionsSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { date, shift } = parsed.data;
    const shiftType = shiftParamToDbValue(shift);

    const [employeesRes, attendanceRes, assignmentsRes] = await Promise.all([
      supabaseAdmin.from("pl_employees").select("*").eq("org_id", activeOrgId),
      supabaseAdmin.from("pl_attendance").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shiftType),
      supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shiftType),
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

    const res = NextResponse.json({ suggestions });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
