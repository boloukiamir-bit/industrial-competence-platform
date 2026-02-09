// services/eligibilityService.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";

type RequirementRow = {
  skill_id: string;
  required_level: number;
};

type EmployeeRow = {
  id: string;
  employee_number: string;
  name: string;
};

type SkillRow = {
  id: string;
  code: string | null;
  name: string | null;
};

export type EligibilityByLineResult = {
  line: string;
  /** Requirement rows (station × skill) count — MANDATORY only. */
  stations_required: number;
  /** Unique required skills count for the line (MANDATORY only). */
  required_skills_count: number;
  required_skill_codes: string[];
  required_skills: { code: string; name: string }[];
  employees: Array<{
    employee_id: string;
    employee_number: string;
    name: string;
    stations_passed: number;
    stations_required: number;
    skills_passed_count: number;
    required_skills_count: number;
    eligible: boolean;
  }>;
};

/**
 * Compute eligibility for a line using canonical sources only:
 * - Stations: public.stations (org_id, line) for station IDs in the line.
 * - Requirements: public.station_skill_requirements (skill_id uuid, required_level).
 *   Only MANDATORY requirements block eligibility (is_mandatory = true); PREFERRED does not block.
 * - Employees in line: public.employees filtered by org_id and line_code (canonical).
 * - Employee skills: public.employee_skills (employee_id, skill_id uuid, level).
 * No join through view; query stations first, then requirements by station_id.
 */
export async function getEligibilityByLine(
  supabaseClient: SupabaseClient<any, any, any>,
  orgId: string,
  lineCode: string
): Promise<EligibilityByLineResult> {
  // 1) Station IDs for this line (canonical: public.stations)
  const { data: stationRows, error: stationsError } = await supabaseClient
    .from("stations")
    .select("id")
    .eq("org_id", orgId)
    .eq("line", lineCode)
    .eq("is_active", true);

  if (stationsError) throw stationsError;
  const stationIds = ((stationRows || []) as { id: string }[]).map((s) => s.id);

  // 2) Requirements for these stations; only MANDATORY block eligibility (is_mandatory = true or null)
  let requirements: RequirementRow[] = [];
  if (stationIds.length > 0) {
    const { data: reqRows, error: reqErr } = await supabaseClient
      .from("station_skill_requirements")
      .select("skill_id, required_level, is_mandatory")
      .eq("org_id", orgId)
      .in("station_id", stationIds);
    if (reqErr) throw reqErr;
    const raw = (reqRows || []) as Array<{ skill_id: string; required_level: number; is_mandatory?: boolean | null }>;
    requirements = raw.filter((r) => r.is_mandatory !== false).map((r) => ({ skill_id: r.skill_id, required_level: r.required_level }));
  }

  const stations_required = requirements.length;
  const requiredSkillIds = Array.from(new Set(requirements.map((r) => r.skill_id).filter(Boolean)));
  const required_skills_count = requiredSkillIds.length;

  const maxRequiredBySkill = new Map<string, number>();
  for (const r of requirements) {
    if (!r.skill_id) continue;
    const level = typeof r.required_level === "number" ? r.required_level : 1;
    const current = maxRequiredBySkill.get(r.skill_id);
    if (current === undefined || level > current) maxRequiredBySkill.set(r.skill_id, level);
  }

  let required_skill_codes: string[] = [];
  const required_skills: { code: string; name: string }[] = [];

  if (requiredSkillIds.length > 0) {
    const { data: skillsData, error: skillsError } = await supabaseClient
      .from("skills")
      .select("id, code, name")
      .eq("org_id", orgId)
      .in("id", requiredSkillIds);
    if (skillsError) throw skillsError;
    const skills = (skillsData || []) as SkillRow[];
    required_skill_codes = skills.map((s) => s.code).filter((c): c is string => Boolean(c));
    required_skills.push(...skills.map((s) => ({ code: s.code ?? s.id, name: s.name ?? s.code ?? s.id })));
  }

  // 3) Employees in this line only (canonical: employees.line_code).
  // Use range to fetch all rows; avoid project default row limit capping the eligible count.
  let empQuery = employeesBaseQuery(supabaseClient, orgId, "id, employee_number, name");
  empQuery = empQuery.eq("line_code", lineCode).range(0, 9999);
  const { data: employeesData, error: employeesError } = await empQuery;
  if (employeesError) throw employeesError;
  const employees = (employeesData || []) as unknown as EmployeeRow[];

  // 4) Employee skills (public.employee_skills by employee_id + skill_id)
  const skillsByEmployee = new Map<string, Map<string, number>>();
  if (requiredSkillIds.length > 0 && employees.length > 0) {
    const employeeIds = employees.map((e) => e.id);
    const { data: esData, error: esErr } = await supabaseClient
      .from("employee_skills")
      .select("employee_id, skill_id, level")
      .in("employee_id", employeeIds)
      .in("skill_id", requiredSkillIds);
    if (esErr) throw esErr;
    for (const row of esData || []) {
      if (!row.employee_id || !row.skill_id) continue;
      const level = typeof row.level === "number" ? row.level : 0;
      const bySkill = skillsByEmployee.get(row.employee_id) || new Map<string, number>();
      const existing = bySkill.get(row.skill_id) ?? -Infinity;
      if (level > existing) bySkill.set(row.skill_id, level);
      skillsByEmployee.set(row.employee_id, bySkill);
    }
  }

  const employeesOut = employees.map((employee) => {
    let stationsPassed = 0;
    let skillsPassedCount = 0;
    const skillLevels = skillsByEmployee.get(employee.id);
    for (const requirement of requirements) {
      const level = skillLevels?.get(requirement.skill_id);
      const requiredLevel = typeof requirement.required_level === "number" ? requirement.required_level : 1;
      if (typeof level === "number" && level >= requiredLevel) stationsPassed += 1;
    }
    for (const skillId of requiredSkillIds) {
      const maxRequired = maxRequiredBySkill.get(skillId);
      const level = skillLevels?.get(skillId);
      if (typeof maxRequired === "number" && typeof level === "number" && level >= maxRequired) skillsPassedCount += 1;
    }
    const eligible = stations_required === 0 || stationsPassed === stations_required;
    return {
      employee_id: employee.id,
      employee_number: employee.employee_number,
      name: employee.name ?? "",
      stations_passed: stationsPassed,
      stations_required,
      skills_passed_count: skillsPassedCount,
      required_skills_count,
      eligible,
    };
  });

  employeesOut.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.stations_passed !== b.stations_passed) return b.stations_passed - a.stations_passed;
    return (a.employee_number ?? "").localeCompare(b.employee_number ?? "");
  });

  return {
    line: lineCode,
    stations_required,
    required_skills_count,
    required_skill_codes,
    required_skills,
    employees: employeesOut,
  };
}
