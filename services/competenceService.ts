import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Employee, Skill, EmployeeSkill, CompetenceLevel } from "@/types/domain";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";

const demoEmployees: Omit<Employee, "id">[] = [
  { name: "Anna Lindberg", employeeNumber: "E1001", role: "Operator", line: "Pressline 1", team: "Day", employmentType: "permanent", isActive: true },
  { name: "Erik Johansson", employeeNumber: "E1002", role: "Operator", line: "Pressline 1", team: "Night", employmentType: "permanent", isActive: true },
  { name: "Maria Svensson", employeeNumber: "E1003", role: "Team Leader", line: "Assembly", team: "Day", employmentType: "permanent", isActive: true },
  { name: "Karl Andersson", employeeNumber: "E1004", role: "Operator", line: "Assembly", team: "Night", employmentType: "temporary", isActive: true },
];

const demoSkills: Omit<Skill, "id">[] = [
  { code: "PRESS_A", name: "Pressline A", category: "Production" },
  { code: "PRESS_B", name: "Pressline B", category: "Production" },
  { code: "5S", name: "5S Basics", category: "Lean" },
  { code: "SAFETY_BASIC", name: "Safety Basic", category: "Safety" },
  { code: "TRUCK_A1", name: "Truck A1 License", category: "Logistics" },
];

const demoSkillLevels: Record<string, Record<string, CompetenceLevel["value"]>> = {
  "E1001": { "PRESS_A": 3, "PRESS_B": 2, "5S": 4, "SAFETY_BASIC": 3, "TRUCK_A1": 1 },
  "E1002": { "PRESS_A": 2, "PRESS_B": 1, "5S": 3, "SAFETY_BASIC": 2, "TRUCK_A1": 0 },
  "E1003": { "PRESS_A": 4, "PRESS_B": 3, "5S": 4, "SAFETY_BASIC": 4, "TRUCK_A1": 2 },
  "E1004": { "PRESS_A": 1, "PRESS_B": 0, "5S": 2, "SAFETY_BASIC": 1, "TRUCK_A1": 0 },
};

/** Strict allowlist of org IDs allowed for demo seeding (comma-separated). Server-side only. */
const DEMO_SEED_ORG_IDS = (process.env.DEMO_SEED_ORG_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Only runs in non-production when org is explicitly allowed (is_demo or DEMO_SEED_ORG_IDS). Throws in production. */
export async function seedDemoDataIfEmpty(orgId?: string | null): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is not allowed in production.");
  }
  if (!orgId) return;
  const inAllowlist = DEMO_SEED_ORG_IDS.includes(orgId);
  if (!inAllowlist) {
    const { data: org } = await supabase
      .from("organizations")
      .select("is_demo")
      .eq("id", orgId)
      .maybeSingle();
    if (org?.is_demo !== true) {
      throw new Error(
        "Demo seeding not allowed: organization is not in DEMO_SEED_ORG_IDS and organizations.is_demo is not true for this org."
      );
    }
  }

  const { data: existingEmployees, error: checkError } = await supabase
    .from("employees")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);

  if (checkError) {
    throw new Error(`Failed to check employees table: ${checkError.message}`);
  }

  if (existingEmployees && existingEmployees.length > 0) {
    return;
  }

  const { data: insertedEmployees, error: employeesError } = await supabase
    .from("employees")
    .insert(
      demoEmployees.map((emp) => ({
        org_id: orgId,
        name: emp.name,
        employee_number: emp.employeeNumber,
        role: emp.role,
        line: emp.line,
        team: emp.team,
        is_active: emp.isActive,
      }))
    )
    .select();

  if (employeesError) {
    throw new Error(`Failed to insert employees: ${employeesError.message}`);
  }

  const { data: insertedSkills, error: skillsError } = await supabase
    .from("skills")
    .insert(
      demoSkills.map((skill) => ({
        org_id: orgId,
        code: skill.code,
        name: skill.name,
        category: skill.category,
      }))
    )
    .select();

  if (skillsError) {
    throw new Error(`Failed to insert skills: ${skillsError.message}`);
  }

  if (!insertedEmployees || !insertedSkills) {
    throw new Error("Failed to get inserted employee or skill IDs");
  }

  const employeeByNumber = new Map<string, string>();
  for (const emp of insertedEmployees) {
    employeeByNumber.set(emp.employee_number, emp.id);
  }

  const skillByCode = new Map<string, string>();
  for (const skill of insertedSkills) {
    skillByCode.set(skill.code, skill.id);
  }

  const employeeSkillsToInsert: { employee_id: string; skill_id: string; level: number }[] = [];

  for (const [empNumber, skills] of Object.entries(demoSkillLevels)) {
    const employeeId = employeeByNumber.get(empNumber);
    if (!employeeId) continue;

    for (const [skillCode, level] of Object.entries(skills)) {
      const skillId = skillByCode.get(skillCode);
      if (!skillId) continue;

      employeeSkillsToInsert.push({
        employee_id: employeeId,
        skill_id: skillId,
        level,
      });
    }
  }

  const { error: employeeSkillsError } = await supabase
    .from("employee_skills")
    .insert(employeeSkillsToInsert);

  if (employeeSkillsError) {
    throw new Error(`Failed to insert employee_skills: ${employeeSkillsError.message}`);
  }
}

export async function getFilterOptions(
  orgId?: string | null,
  options?: { allowGlobal?: boolean; supabaseClient?: SupabaseClient }
): Promise<{
  lines: string[];
  teams: string[];
}> {
  const client = options?.supabaseClient ?? supabase;
  const allowGlobal = options?.allowGlobal === true;
  if (!orgId && !allowGlobal) {
    return { lines: [], teams: [] };
  }
  const query = orgId
    ? employeesBaseQuery(client, orgId, "line, team")
    : client.from("employees").select("line, team").eq("is_active", true);
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch filter options: ${error.message}`);
  }

  type Row = { line?: string | null; team?: string | null };
  const rows = (data || []) as Row[];
  const lines = [...new Set(rows.map((row) => row.line).filter((x): x is string => Boolean(x)))].sort();
  const teams = [...new Set(rows.map((row) => row.team).filter((x): x is string => Boolean(x)))].sort();

  return { lines, teams };
}

export async function getEmployeesWithSkills(filters?: {
  orgId?: string | null;
  line?: string;
  team?: string;
  allowGlobal?: boolean;
  supabaseClient?: SupabaseClient;
}): Promise<{
  employees: Employee[];
  skills: Skill[];
  employeeSkills: EmployeeSkill[];
}> {
  const orgId = filters?.orgId ?? null;
  const client = filters?.supabaseClient ?? supabase;
  if (!orgId) {
    return { employees: [], skills: [], employeeSkills: [] };
  }

  const { data: catalogRows, error: catalogError } = await client
    .from("skills")
    .select("id, code, name, category")
    .eq("org_id", orgId)
    .order("category")
    .order("code");

  if (catalogError) {
    throw new Error(`Failed to fetch skills catalog: ${catalogError.message}`);
  }

  type SkillRow = {
    id: string;
    code: string;
    name: string;
    category: string;
  };
  const skills: Skill[] = (catalogRows || []).map((row: SkillRow) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
  }));

  let employeesQuery = employeesBaseQuery(client, orgId).select("*");
  if (filters?.line) {
    employeesQuery = employeesQuery.eq("line", filters.line);
  }
  if (filters?.team) {
    employeesQuery = employeesQuery.eq("team", filters.team);
  }

  const employeesResult = await employeesQuery;

  if (employeesResult.error) {
    throw new Error(`Failed to fetch employees: ${employeesResult.error.message}`);
  }

  const employees: Employee[] = (employeesResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    employeeNumber: row.employee_number,
    role: row.role,
    line: row.line,
    team: row.team,
    employmentType: row.employment_type || "permanent",
    isActive: row.is_active,
  }));

  let employeeSkills: EmployeeSkill[] = [];
  if (employees.length > 0) {
    const employeeIds = employees.map((e) => e.id);
    const employeeSkillsResult = await client
      .from("employee_skills")
      .select("employee_id, skill_id, level")
      .in("employee_id", employeeIds);

    if (employeeSkillsResult.error) {
      throw new Error(`Failed to fetch employee_skills: ${employeeSkillsResult.error.message}`);
    }

    const skillIds = new Set(skills.map((s) => s.id));
    employeeSkills = (employeeSkillsResult.data || []).map((row) => ({
      employeeId: row.employee_id,
      skillId: row.skill_id,
      level: row.level as CompetenceLevel["value"],
    })).filter((es) => skillIds.has(es.skillId));
  }

  return { employees, skills, employeeSkills };
}

export interface CompetenceGap {
  line: string;
  team: string;
  skillName: string;
  skillCode: string;
  requiredLevel: number;
  requiredHeadcount: number;
  actualHeadcount: number;
  missingHeadcount: number;
}

export async function getTomorrowsGaps(orgId?: string | null): Promise<CompetenceGap[]> {
  if (!orgId) return [];
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  const { data: requirements, error: reqError } = await supabase
    .from("competence_requirements")
    .select("id, line, team, skill_id, min_level, min_headcount, effective_date")
    .lte("effective_date", targetDateStr);

  if (reqError) {
    throw new Error(`Failed to fetch competence_requirements: ${reqError.message}`);
  }

  if (!requirements || requirements.length === 0) {
    return [];
  }

  const skillIds = [...new Set(requirements.map((r) => r.skill_id))];
  const { data: skills, error: skillsError } = await supabase
    .from("skills")
    .select("id, code, name")
    .in("id", skillIds)
    .eq("org_id", orgId);

  if (skillsError) {
    throw new Error(`Failed to fetch skills: ${skillsError.message}`);
  }

  const skillMap = new Map<string, { code: string; name: string }>();
  for (const skill of skills || []) {
    skillMap.set(skill.id, { code: skill.code, name: skill.name });
  }

  const gaps: CompetenceGap[] = [];

  for (const req of requirements) {
    const { line, team, skill_id, min_level, min_headcount } = req;

    const skillInfo = skillMap.get(skill_id);
    if (!skillInfo) continue;

    const { data: matchingEmployees, error: empError } = await employeesBaseQuery(
      supabase,
      orgId,
      "id"
    )
      .eq("line", line)
      .eq("team", team);

    if (empError) {
      throw new Error(`Failed to fetch employees for ${line}/${team}: ${empError.message}`);
    }

    const employeeIds = ((matchingEmployees || []) as unknown as { id: string }[]).map((e) => e.id);

    let actualHeadcount = 0;

    if (employeeIds.length > 0) {
      const { data: qualifiedSkills, error: esError } = await supabase
        .from("employee_skills")
        .select("employee_id")
        .eq("skill_id", skill_id)
        .gte("level", min_level)
        .in("employee_id", employeeIds);

      if (esError) {
        throw new Error(`Failed to fetch employee_skills: ${esError.message}`);
      }

      actualHeadcount = qualifiedSkills?.length || 0;
    }

    const requiredHeadcount = min_headcount;
    const missingHeadcount = Math.max(0, requiredHeadcount - actualHeadcount);

    if (missingHeadcount > 0) {
      gaps.push({
        line,
        team,
        skillCode: skillInfo.code,
        skillName: skillInfo.name,
        requiredLevel: min_level,
        requiredHeadcount,
        actualHeadcount,
        missingHeadcount,
      });
    }
  }

  return gaps;
}

interface RawGap {
  line_name: string;
  role_name: string;
  skill_name: string;
  missing: number;
}

export function getCriticalGaps(gaps: RawGap[]) {
  return gaps
    .filter(g => g.missing > 0)
    .map(g => ({
      line: g.line_name,
      role: g.role_name,
      skill: g.skill_name,
      missingCount: g.missing,
    }));
}

interface SkillStats {
  level_0: number;
  level_1: number;
}

export function getTrainingPriorities(skillsStats: Record<string, SkillStats>) {
  return Object.entries(skillsStats)
    .map(([skill, stats]) => ({
      skill,
      countLevel0or1: stats.level_0 + stats.level_1,
    }))
    .filter(i => i.countLevel0or1 > 0)
    .sort((a, b) => b.countLevel0or1 - a.countLevel0or1);
}

interface FullSkillStats {
  level_0: number;
  level_1: number;
  level_3: number;
  level_4: number;
}

export function getOverstaffedSkills(skillsStats: Record<string, FullSkillStats>) {
  return Object.entries(skillsStats)
    .map(([skill, stats]) => ({
      skill,
      countLevel3or4: stats.level_3 + stats.level_4,
    }))
    .filter(i => i.countLevel3or4 >= 3)
    .sort((a, b) => b.countLevel3or4 - a.countLevel3or4);
}
