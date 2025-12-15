import { supabase } from "@/lib/supabaseClient";
import type { Employee, Skill, EmployeeSkill, CompetenceLevel } from "@/types/domain";

const demoEmployees: Omit<Employee, "id">[] = [
  { name: "Anna Lindberg", employeeNumber: "E1001", role: "Operator", line: "Line A", team: "Team Alpha", isActive: true },
  { name: "Erik Johansson", employeeNumber: "E1002", role: "Technician", line: "Line A", team: "Team Alpha", isActive: true },
  { name: "Maria Svensson", employeeNumber: "E1003", role: "Operator", line: "Line B", team: "Team Beta", isActive: true },
  { name: "Karl Andersson", employeeNumber: "E1004", role: "Supervisor", line: "Line B", team: "Team Beta", isActive: true },
];

const demoSkills: Omit<Skill, "id">[] = [
  { code: "WLD-01", name: "MIG Welding", category: "Welding", description: "Metal Inert Gas welding technique" },
  { code: "WLD-02", name: "TIG Welding", category: "Welding", description: "Tungsten Inert Gas welding technique" },
  { code: "CNC-01", name: "CNC Operation", category: "Machining", description: "Computer Numerical Control machine operation" },
  { code: "QC-01", name: "Quality Inspection", category: "Quality", description: "Quality control and inspection procedures" },
  { code: "SAF-01", name: "Safety Protocols", category: "Safety", description: "Workplace safety and emergency procedures" },
];

const demoSkillLevels: CompetenceLevel["value"][][] = [
  [3, 2, 1, 2, 4],
  [4, 4, 3, 2, 3],
  [2, 0, 4, 3, 3],
  [2, 1, 2, 4, 4],
];

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
        description: skill.description,
      }))
    )
    .select();

  if (skillsError) {
    throw new Error(`Failed to insert skills: ${skillsError.message}`);
  }

  if (!insertedEmployees || !insertedSkills) {
    throw new Error("Failed to get inserted employee or skill IDs");
  }

  const employeeSkillsToInsert: { employee_id: string; skill_id: string; level: number }[] = [];

  for (let empIndex = 0; empIndex < insertedEmployees.length; empIndex++) {
    for (let skillIndex = 0; skillIndex < insertedSkills.length; skillIndex++) {
      employeeSkillsToInsert.push({
        employee_id: insertedEmployees[empIndex].id,
        skill_id: insertedSkills[skillIndex].id,
        level: demoSkillLevels[empIndex][skillIndex],
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

export async function getEmployeesWithSkills(): Promise<{
  employees: Employee[];
  skills: Skill[];
  employeeSkills: EmployeeSkill[];
}> {
  const [employeesResult, skillsResult, employeeSkillsResult] = await Promise.all([
    supabase.from("employees").select("*"),
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
