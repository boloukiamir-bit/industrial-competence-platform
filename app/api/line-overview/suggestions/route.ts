import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftTypeOrDefault } from "@/lib/shift";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";
import { normalizeEmployeeLineToCode } from "@/lib/lineOverviewLineNames";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const suggestionsSchema = z.object({
  machineCode: z.string(),
  date: z.string(),
  shift: z.string(),
  hoursNeeded: z.number().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    const { data: stationsLineData, error: stationsError } = await supabaseAdmin
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

    const stationLines = [...new Set((stationsLineData || []).map((s: { line?: string }) => s.line).filter((v): v is string => Boolean(v)))].sort();

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

    const { machineCode, date, shift } = parsed.data;
    const shiftType = normalizeShiftTypeOrDefault(shift);

    let lineCode: string | null = null;
    const byCode = await supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .eq("code", machineCode)
      .maybeSingle();
    if (byCode.data?.line) {
      lineCode = byCode.data.line as string;
    } else {
      const byId = await supabaseAdmin
        .from("stations")
        .select("line")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("id", machineCode)
        .maybeSingle();
      if (byId.data?.line) lineCode = byId.data.line as string;
    }

    let employeesQuery = employeesBaseQuery(supabaseAdmin, activeOrgId, "id, employee_number, name, line");
    if (activeSiteId) {
      employeesQuery = employeesQuery.eq("site_id", activeSiteId);
    }

    const [employeesRes, attendanceRes, assignmentsRes, requirementRowsRes] = await Promise.all([
      employeesQuery,
      supabaseAdmin.from("pl_attendance").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shiftType),
      supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shiftType),
      lineCode
        ? supabaseAdmin
            .from("station_skill_requirements")
            .select("skill_id, required_level, stations!inner(line, org_id)")
            .eq("stations.line", lineCode)
            .eq("stations.org_id", activeOrgId)
        : Promise.resolve({ data: [] as { skill_id: string; required_level: number }[], error: null }),
    ]);

    if (employeesRes.error) throw employeesRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (requirementRowsRes.error) throw requirementRowsRes.error;

    const allEmployees = (employeesRes.data || []) as unknown as Array<{
      id: string;
      employee_number: string;
      name: string;
      line?: string | null;
    }>;
    const employeesConsidered = allEmployees.length;
    const filteredByLineCode = lineCode ? normalizeEmployeeLineToCode(lineCode) : null;
    const employees = filteredByLineCode
      ? allEmployees.filter((emp) => normalizeEmployeeLineToCode(emp?.line) === filteredByLineCode)
      : allEmployees;
    const employeesAfterLineFilter = employees.length;

    const attendance = attendanceRes.data || [];
    const assignments = assignmentsRes.data || [];
    const requirementRows = (requirementRowsRes.data || []) as { skill_id: string; required_level: number }[];
    const stationsRequired = requirementRows.length;

    const requiredSkillIds = Array.from(new Set(requirementRows.map((r) => r.skill_id).filter(Boolean)));
    const skillsByEmployee = new Map<string, Map<string, number>>();
    if (requiredSkillIds.length > 0 && employees.length > 0) {
      const employeeIds = employees.map((e: { id: string }) => e.id);
      const { data: skillsData, error: skillsError } = await supabaseAdmin
        .from("employee_skills")
        .select("employee_id, skill_id, level")
        .in("employee_id", employeeIds)
        .in("skill_id", requiredSkillIds);
      if (skillsError) throw skillsError;
      for (const row of skillsData || []) {
        if (!row.employee_id || !row.skill_id) continue;
        const level = typeof row.level === "number" ? row.level : 0;
        const bySkill = skillsByEmployee.get(row.employee_id) || new Map<string, number>();
        const existing = bySkill.get(row.skill_id) ?? -Infinity;
        if (level > existing) bySkill.set(row.skill_id, level);
        skillsByEmployee.set(row.employee_id, bySkill);
      }
    }

    const attendanceMap = new Map(
      attendance.map((a: { employee_code: string; status?: string }) => [a.employee_code, a])
    );

    const suggestions = employees
      .filter((emp: { employee_number: string }) => {
        const att = attendanceMap.get(emp.employee_number) as
          | { status?: string }
          | undefined;
        return !att || att.status === "present";
      })
      .map((emp: { id: string; employee_number: string; name: string }) => {
        const empAssignments = assignments.filter((a: { employee_code: string }) => a.employee_code === emp.employee_number);
        let currentHours = 0;
        empAssignments.forEach((a: { start_time: string; end_time: string }) => {
          const start = new Date(`2000-01-01T${a.start_time}`);
          const end = new Date(`2000-01-01T${a.end_time}`);
          currentHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        });

        const score = 100 - (currentHours / 8) * 50;
        const availableHours = Math.max(0, 8 - currentHours);

        let stationsPassed = 0;
        const skillLevels = skillsByEmployee.get(emp.id);
        for (const req of requirementRows) {
          const level = skillLevels?.get(req.skill_id);
          if (typeof level === "number" && level >= req.required_level) stationsPassed += 1;
        }
        const eligible = stationsRequired > 0 && stationsPassed === stationsRequired;

        return {
          employee: {
            id: emp.id,
            employee_number: emp.employee_number,
            full_name: emp.name,
          },
          currentHours,
          availableHours,
          score,
          eligible,
          stationsPassed,
          stationsRequired,
        };
      })
      .filter((s: { availableHours: number }) => s.availableHours > 0)
      .sort(
        (a: { eligible: boolean; stationsPassed: number; availableHours: number; employee: { employee_number: string } }, b: { eligible: boolean; stationsPassed: number; availableHours: number; employee: { employee_number: string } }) => {
          if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
          if (a.stationsPassed !== b.stationsPassed) return b.stationsPassed - a.stationsPassed;
          if (a.availableHours !== b.availableHours) return b.availableHours - a.availableHours;
          return a.employee.employee_number.localeCompare(b.employee.employee_number);
        }
      )
      .slice(0, 50);

    const res = NextResponse.json({
      suggestions,
      _meta: {
        filteredByLineCode,
        employeesConsidered,
        employeesAfterLineFilter,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
