import { supabase } from "@/lib/supabaseClient";
import type { CertificateInfo } from "@/types/domain";

export async function getCertificates(filters?: {
  orgId?: string;
  line?: string;
  skillName?: string;
}): Promise<CertificateInfo[]> {
  if (!filters?.orgId) return [];
  let query = supabase
    .from("employee_skills")
    .select(`
      employee_id,
      skill_id,
      level,
      employees!inner(id, name, line, team),
      skills!inner(id, name, code, category)
    `)
    .eq("employees.is_active", true)
    .eq("employees.org_id", filters.orgId)
    .eq("skills.org_id", filters.orgId)
    .in("skills.category", ["safety", "certificate"]);

  if (filters?.line) {
    query = query.eq("employees.line", filters.line);
  }

  const { data: skillsData, error: skillsError } = await query;

  if (skillsError) throw new Error(skillsError.message);

  const employeeIds = [...new Set((skillsData || []).map((s: Record<string, unknown>) => {
    const emp = s.employees as Record<string, unknown>;
    return emp?.id as string;
  }).filter(Boolean))];

  let trainingEvents: Record<string, unknown>[] = [];
  if (employeeIds.length > 0) {
    const { data: eventsData } = await supabase
      .from("person_events")
      .select("employee_id, category, completed_date, due_date")
      .eq("category", "training")
      .in("employee_id", employeeIds);
    trainingEvents = eventsData || [];
  }

  const trainingByEmployee = new Map<string, { completedDate?: string; dueDate?: string }>();
  for (const event of trainingEvents) {
    const empId = event.employee_id as string;
    if (!trainingByEmployee.has(empId)) {
      trainingByEmployee.set(empId, {
        completedDate: event.completed_date as string | undefined,
        dueDate: event.due_date as string | undefined,
      });
    } else {
      const existing = trainingByEmployee.get(empId)!;
      if (event.completed_date && (!existing.completedDate || event.completed_date > existing.completedDate)) {
        existing.completedDate = event.completed_date as string;
      }
      if (event.due_date && (!existing.dueDate || event.due_date > existing.dueDate)) {
        existing.dueDate = event.due_date as string;
      }
    }
  }

  let results: CertificateInfo[] = (skillsData || []).map((row: Record<string, unknown>) => {
    const emp = row.employees as Record<string, unknown>;
    const skill = row.skills as Record<string, unknown>;
    const empId = emp?.id as string;
    const training = trainingByEmployee.get(empId);

    return {
      employeeId: empId,
      employeeName: emp?.name as string,
      line: emp?.line as string,
      team: emp?.team as string,
      skillId: skill?.id as string,
      skillName: skill?.name as string,
      skillCode: skill?.code as string,
      currentLevel: row.level as number,
      latestTrainingDate: training?.completedDate,
      nextDueDate: training?.dueDate,
    };
  });

  if (filters?.skillName) {
    results = results.filter((c) => 
      c.skillName.toLowerCase().includes(filters.skillName!.toLowerCase())
    );
  }

  return results;
}

export async function getFilterOptionsForCertificates(orgId: string): Promise<{
  lines: string[];
  skills: { id: string; name: string }[];
}> {
  if (!orgId) return { lines: [], skills: [] };
  const [linesResult, skillsResult] = await Promise.all([
    supabase.from("employees").select("line").eq("org_id", orgId).eq("is_active", true),
    supabase.from("skills").select("id, name").eq("org_id", orgId).in("category", ["safety", "certificate"]),
  ]);

  const lines = [...new Set((linesResult.data || []).map((r) => r.line).filter(Boolean))].sort();
  const skills = (skillsResult.data || []).map((s) => ({ id: s.id, name: s.name }));

  return { lines, skills };
}
