import { supabase } from "@/lib/supabaseClient";
import type { Employee, Skill, EmployeeSkill, CompetenceLevel } from "@/types/domain";

const demoEmployees: Omit<Employee, "id">[] = [
  { name: "Anna Lindberg", employeeNumber: "E1001", role: "Operator", line: "Pressline 1", team: "Day", isActive: true },
  { name: "Erik Johansson", employeeNumber: "E1002", role: "Operator", line: "Pressline 1", team: "Night", isActive: true },
  { name: "Maria Svensson", employeeNumber: "E1003", role: "Team Leader", line: "Assembly", team: "Day", isActive: true },
  { name: "Karl Andersson", employeeNumber: "E1004", role: "Operator", line: "Assembly", team: "Night", isActive: true },
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

export async function seedDemoDataIfEmpty(): Promise<void> {
  const { data: existingEmployees, error: checkError } = await supabase
    .from("employees")
    .select("id")
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

export async function getFilterOptions(): Promise<{
  lines: string[];
  teams: string[];
}> {
  const { data, error } = await supabase
    .from("employees")
    .select("line, team");

  if (error) {
    throw new Error(`Failed to fetch filter options: ${error.message}`);
  }

  const lines = [...new Set((data || []).map((row) => row.line).filter(Boolean))].sort();
  const teams = [...new Set((data || []).map((row) => row.team).filter(Boolean))].sort();

  return { lines, teams };
}

export async function getEmployeesWithSkills(filters?: {
  line?: string;
  team?: string;
}): Promise<{
  employees: Employee[];
  skills: Skill[];
  employeeSkills: EmployeeSkill[];
}> {
  let employeesQuery = supabase.from("employees").select("*");
  
  if (filters?.line) {
    employeesQuery = employeesQuery.eq("line", filters.line);
  }
  if (filters?.team) {
    employeesQuery = employeesQuery.eq("team", filters.team);
  }

  const [employeesResult, skillsResult, employeeSkillsResult] = await Promise.all([
    employeesQuery,
    supabase.from("skills").select("*"),
    supabase.from("employee_skills").select("*"),
  ]);

  if (employeesResult.error) {
    throw new Error(`Failed to fetch employees: ${employeesResult.error.message}`);
  }

  if (skillsResult.error) {
    throw new Error(`Failed to fetch skills: ${skillsResult.error.message}`);
  }

  if (employeeSkillsResult.error) {
    throw new Error(`Failed to fetch employee_skills: ${employeeSkillsResult.error.message}`);
  }

  const employees: Employee[] = (employeesResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    employeeNumber: row.employee_number,
    role: row.role,
    line: row.line,
    team: row.team,
    isActive: row.is_active,
  }));

  const skills: Skill[] = (skillsResult.data || []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
  }));

  const employeeSkills: EmployeeSkill[] = (employeeSkillsResult.data || []).map((row) => ({
    employeeId: row.employee_id,
    skillId: row.skill_id,
    level: row.level as CompetenceLevel["value"],
  }));

  return { employees, skills, employeeSkills };
}
