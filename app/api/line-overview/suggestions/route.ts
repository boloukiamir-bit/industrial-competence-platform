/**
 * GET /api/line-overview/suggestions — query: machineCode, date, shift, hoursNeeded, includeAbsent?, debug=1
 * POST /api/line-overview/suggestions — body: { machineCode, date, shift, hoursNeeded, includeAbsent?, debug? }
 *
 * When station has 0 requirements: all candidates are eligible, reasons include "no_requirements_configured",
 * requiredSkillsCount=0, skillsPassedCount=0, stationCoverage={ covered: 0, required: 0 }.
 *
 * Example response (camelCase, ?debug=1 adds debug block):
 * {
 *   "suggestions": [
 *     {
 *       "employee": { "id": "...", "employeeNumber": "0001", "fullName": "Jane Doe" },
 *       "currentAssignedHours": 0,
 *       "availableHours": 8,
 *       "score": 100,
 *       "eligible": true,
 *       "reasons": [],
 *       "requiredSkillsCount": 2,
 *       "skillsPassedCount": 2,
 *       "stationCoverage": { "covered": 2, "required": 2 }
 *     },
 *     {
 *       "employee": { "id": "...", "employeeNumber": "0002", "fullName": "John Smith" },
 *       "currentAssignedHours": 2,
 *       "availableHours": 6,
 *       "score": 75,
 *       "eligible": false,
 *       "reasons": ["MISSING_SKILLS"],
 *       "requiredSkillsCount": 2,
 *       "skillsPassedCount": 1,
 *       "stationCoverage": { "covered": 1, "required": 2 }
 *     }
 *   ],
 *   "debug": {
 *     "stationId": "uuid-of-station",
 *     "shiftType": "Day",
 *     "requiredSkillIds": ["skill-uuid-1", "skill-uuid-2"],
 *     "candidateCount": 10,
 *     "eligibleCount": 3,
 *     "excludedAbsentCount": 1
 *   }
 * }
 */
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
  includeAbsent: z.boolean().optional(),
});

/** Resolve station and line by machineCode only. machineCode must match stations.code (org-scoped). Never use stations.id. */
async function resolveStationByCode(
  orgId: string,
  machineCode: string
): Promise<{ stationId: string | null; lineCode: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("stations")
    .select("id, line")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("code", machineCode)
    .maybeSingle();
  if (error || !data) return { stationId: null, lineCode: null };
  return {
    stationId: (data as { id?: string }).id ?? null,
    lineCode: (data as { line?: string }).line ?? null,
  };
}

async function handleSuggestions(
  request: NextRequest,
  params: { machineCode: string; date: string; shift: string; hoursNeeded: number; includeAbsent: boolean; debug: boolean }
) {
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
    const body: { suggestions: unknown[]; debug?: unknown } = { suggestions: [] };
    if (params.debug) body.debug = { stationId: null, shiftType: params.shift, requiredSkillIds: [], candidateCount: 0, eligibleCount: 0, excludedAbsentCount: 0 };
    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { machineCode, date, shift, includeAbsent, debug } = params;
  const shiftType = normalizeShiftTypeOrDefault(shift);

  const { stationId, lineCode } = await resolveStationByCode(activeOrgId, machineCode);

  let employeesQuery = employeesBaseQuery(supabaseAdmin, activeOrgId, "id, employee_number, name, line, line_code");
  if (activeSiteId) {
    employeesQuery = employeesQuery.eq("site_id", activeSiteId);
  }

  // Requirements by station_id so a station with 0 requirements is correctly identified
  const requirementRowsRes = stationId
    ? await supabaseAdmin
        .from("station_skill_requirements")
        .select("skill_id, required_level")
        .eq("station_id", stationId)
        .eq("org_id", activeOrgId)
    : { data: [] as { skill_id: string; required_level: number }[], error: null };

  const [employeesRes, attendanceRes, assignmentsRes] = await Promise.all([
    employeesQuery,
    supabaseAdmin
      .from("attendance_records")
      .select("employee_id, status")
      .eq("org_id", activeOrgId)
      .eq("work_date", date)
      .eq("shift_type", shiftType),
    supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", activeOrgId).eq("plan_date", date).eq("shift_type", shiftType),
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
    line_code?: string | null;
  }>;
  const filteredByLineCode = lineCode ? normalizeEmployeeLineToCode(lineCode) : null;
  const employees = filteredByLineCode
    ? allEmployees.filter((emp) => (emp?.line_code ?? normalizeEmployeeLineToCode(emp?.line ?? "")) === filteredByLineCode)
    : allEmployees;

  const attendance = attendanceRes.data || [];
  const assignments = assignmentsRes.data || [];
  const requirementRows = (requirementRowsRes.data || []) as { skill_id: string; required_level: number }[];
  const rawSkillIds = Array.from(new Set(requirementRows.map((r) => r.skill_id).filter(Boolean)));

  // Tenant safety: only skills belonging to active org (station_skill_requirements.skill_id -> skills.id, scope by employees.org_id; skills.org_id = activeOrgId)
  let requiredSkillIds: string[] = [];
  if (rawSkillIds.length > 0) {
    const { data: orgSkills, error: orgSkillsErr } = await supabaseAdmin
      .from("skills")
      .select("id")
      .eq("org_id", activeOrgId)
      .in("id", rawSkillIds);
    if (orgSkillsErr) throw orgSkillsErr;
    requiredSkillIds = (orgSkills || []).map((s: { id: string }) => s.id);
  }
  const requiredCount = requiredSkillIds.length;

  // Single source of truth: public.employee_skills. Scope via employees.org_id (employee_ids from org-scoped employees above).
  const skillsByEmployee = new Map<string, Map<string, number>>();
  if (requiredSkillIds.length > 0 && employees.length > 0) {
    const employeeIds = employees.map((e) => e.id);
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

  const attendanceByEmployeeId = new Map(
    (attendance || []).map((a: { employee_id: string; status?: string }) => [a.employee_id, a])
  );

  // Exclude ONLY when attendance.status === "absent" AND includeAbsent is false. Missing attendance record = included.
  let excludedAbsentCount = 0;
  const candidates = employees.filter((emp) => {
    if (includeAbsent) return true;
    const att = attendanceByEmployeeId.get(emp.id) as { status?: string } | undefined;
    if (att != null && att.status === "absent") {
      excludedAbsentCount += 1;
      return false;
    }
    return true;
  });

  type Candidate = {
    employee: { id: string; employeeNumber: string; fullName: string };
    currentAssignedHours: number;
    availableHours: number;
    score: number;
    eligible: boolean;
    reasons: string[];
    requiredSkillsCount: number;
    skillsPassedCount: number;
    stationCoverage: { covered: number; required: number };
  };

  const suggestions: Candidate[] = candidates
    .map((emp) => {
      const empAssignments = assignments.filter((a: { employee_code: string }) => a.employee_code === emp.employee_number);
      let currentHours = 0;
      empAssignments.forEach((a: { start_time: string; end_time: string }) => {
        const start = new Date(`2000-01-01T${a.start_time}`);
        const end = new Date(`2000-01-01T${a.end_time}`);
        currentHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      });
      const score = 100 - (currentHours / 8) * 50;
      const availableHours = Math.max(0, 8 - currentHours);

      // Skill matching: employee_skills by employee_id + skill_id; eligibility when employee_skills.level >= required_level
      let skillsPassedCount = 0;
      const skillLevels = skillsByEmployee.get(emp.id);
      for (const req of requirementRows) {
        if (!requiredSkillIds.includes(req.skill_id)) continue;
        const level = skillLevels?.get(req.skill_id);
        const requiredLevel = typeof req.required_level === "number" ? req.required_level : 1;
        if (typeof level === "number" && level >= requiredLevel) skillsPassedCount += 1;
      }

      const reasons: string[] = [];
      if (!stationId || !lineCode) {
        reasons.push("NO_STATION_COVERAGE");
      } else if (requiredCount === 0) {
        reasons.push("no_requirements_configured");
      } else if (skillsPassedCount < requiredCount) {
        reasons.push("MISSING_SKILLS");
      }
      // When requiredCount === 0: employee eligible (subject to attendance + not already assigned); reason "no_requirements_configured"
      const eligible = !reasons.includes("NO_STATION_COVERAGE") && (requiredCount === 0 || skillsPassedCount >= requiredCount);
      const stationCoverage = { covered: skillsPassedCount, required: requiredCount };

      return {
        employee: {
          id: emp.id,
          employeeNumber: emp.employee_number,
          fullName: emp.name,
        },
        currentAssignedHours: currentHours,
        availableHours,
        score,
        eligible,
        reasons,
        requiredSkillsCount: requiredCount,
        skillsPassedCount,
        stationCoverage,
      };
    })
    .filter((s) => s.availableHours > 0)
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (a.skillsPassedCount !== b.skillsPassedCount) return b.skillsPassedCount - a.skillsPassedCount;
      if (a.availableHours !== b.availableHours) return b.availableHours - a.availableHours;
      return a.employee.employeeNumber.localeCompare(b.employee.employeeNumber);
    })
    .slice(0, 50);

  const eligibleCount = suggestions.filter((s) => s.eligible).length;
  const payload: {
    suggestions: Candidate[];
    debug?: { stationId: string | null; shiftType: string; requiredSkillIds: string[]; candidateCount: number; eligibleCount: number; excludedAbsentCount: number };
  } = { suggestions };
  if (debug) {
    payload.debug = {
      stationId,
      shiftType,
      requiredSkillIds,
      candidateCount: suggestions.length,
      eligibleCount,
      excludedAbsentCount,
    };
  }
  const res = NextResponse.json(payload);
  applySupabaseCookies(res, pendingCookies);
  return res;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineCode = searchParams.get("machineCode");
    const date = searchParams.get("date");
    const shift = searchParams.get("shift");
    const hoursNeededParam = searchParams.get("hoursNeeded");
    const includeAbsent = searchParams.get("includeAbsent") === "true";
    const debug = searchParams.get("debug") === "1";
    const hoursNeeded = hoursNeededParam ? Number(hoursNeededParam) : 8;
    const parsed = z.object({ machineCode: z.string(), date: z.string(), shift: z.string(), hoursNeeded: z.number().positive() }).safeParse({
      machineCode: machineCode ?? "",
      date: date ?? "",
      shift: shift ?? "",
      hoursNeeded,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.issues }, { status: 400 });
    }
    return handleSuggestions(request, { ...parsed.data, includeAbsent, debug });
  } catch (error) {
    console.error("Suggestions GET error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = suggestionsSchema.safeParse(body);
    if (!parsed.success) {
      const { supabase, pendingCookies } = await createSupabaseServerClient();
      const res = NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const { machineCode, date, shift, hoursNeeded, includeAbsent = false } = parsed.data;
    const debug = (body as { debug?: boolean }).debug === true || (request.nextUrl.searchParams.get("debug") === "1");
    return handleSuggestions(request, { machineCode, date, shift, hoursNeeded, includeAbsent, debug });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
