import { supabase } from "@/lib/supabaseClient";
import type { HRAnalytics } from "@/types/domain";

export async function getHRAnalytics(): Promise<HRAnalytics> {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [
    headcountRes,
    employeesWithOrgRes,
    tempContractsRes,
    allEventsRes,
    skillsRes,
    absencesRes,
  ] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
    
    supabase
      .from("employees")
      .select("id, name, role, employment_type, contract_end_date, line, team, org_unit_id")
      .eq("is_active", true),
    
    supabase
      .from("employees")
      .select("id, name, role, contract_end_date")
      .eq("is_active", true)
      .eq("employment_type", "temporary")
      .not("contract_end_date", "is", null)
      .lte("contract_end_date", ninetyDaysLater),
    
    supabase
      .from("person_events")
      .select("id, category, status, due_date, employee_id, employees:employee_id(line, team)")
      .neq("status", "completed"),
    
    supabase
      .from("employee_skills")
      .select("level, skills(name)")
      .order("level"),
    
    supabase
      .from("absences")
      .select("id, type, from_date, to_date"),
  ]);

  const totalHeadcount = headcountRes.count || 0;
  const employees = employeesWithOrgRes.data || [];

  const orgUnitData: Record<string, { count: number; permanent: number; temporary: number; consultant: number }> = {};
  const employmentTypeCounts: Record<string, number> = {};

  for (const emp of employees) {
    const unitName = emp.line || emp.team || "Unassigned";
    const empType = emp.employment_type || "unknown";

    if (!orgUnitData[unitName]) {
      orgUnitData[unitName] = { count: 0, permanent: 0, temporary: 0, consultant: 0 };
    }
    orgUnitData[unitName].count++;
    if (empType === "permanent") orgUnitData[unitName].permanent++;
    else if (empType === "temporary") orgUnitData[unitName].temporary++;
    else if (empType === "consultant") orgUnitData[unitName].consultant++;

    employmentTypeCounts[empType] = (employmentTypeCounts[empType] || 0) + 1;
  }

  const headcountByOrgUnit = Object.entries(orgUnitData).map(([orgUnitName, data]) => ({
    orgUnitName,
    count: data.count,
    permanent: data.permanent,
    temporary: data.temporary,
    consultant: data.consultant,
  }));

  const headcountByEmploymentType = Object.entries(employmentTypeCounts).map(([type, count]) => ({
    type,
    count,
  }));

  const tempContracts = tempContractsRes.data || [];
  const temporaryContractsEndingSoon = tempContracts.length;
  const temporaryContractsEndingList = tempContracts.map((emp) => ({
    id: emp.id,
    name: emp.name,
    contractEndDate: emp.contract_end_date,
    role: emp.role || "Unknown",
  }));

  const allEvents = allEventsRes.data || [];
  const criticalEventsCounts: Record<string, number> = {};
  let overdueCount = 0;
  let dueSoonCount = 0;

  const unitEventCounts: Record<string, { overdueCount: number; dueSoonCount: number }> = {};

  for (const event of allEvents) {
    if (!event.due_date) continue;
    const isOverdue = event.due_date < today;
    const isDueSoon = event.due_date >= today && event.due_date <= thirtyDaysLater;

    if (isOverdue) overdueCount++;
    if (isDueSoon) dueSoonCount++;

    if (isOverdue || isDueSoon) {
      criticalEventsCounts[event.category] = (criticalEventsCounts[event.category] || 0) + 1;
    }

    const empData = event.employees as unknown;
    const empInfo = Array.isArray(empData) ? empData[0] : empData;
    const unitName = (empInfo as { line?: string; team?: string } | null)?.line || 
                     (empInfo as { line?: string; team?: string } | null)?.team || 
                     "Unassigned";

    if (!unitEventCounts[unitName]) {
      unitEventCounts[unitName] = { overdueCount: 0, dueSoonCount: 0 };
    }
    if (isOverdue) unitEventCounts[unitName].overdueCount++;
    if (isDueSoon) unitEventCounts[unitName].dueSoonCount++;
  }

  const criticalEventsCount = Object.entries(criticalEventsCounts).map(([category, count]) => ({
    category,
    count,
  }));

  const riskIndexByUnit = Object.entries(orgUnitData).map(([unitName, data]) => {
    const eventData = unitEventCounts[unitName] || { overdueCount: 0, dueSoonCount: 0 };
    const riskIndex = data.count > 0 
      ? (eventData.overdueCount + eventData.dueSoonCount) / data.count 
      : 0;
    return {
      unitName,
      headcount: data.count,
      overdueCount: eventData.overdueCount,
      dueSoonCount: eventData.dueSoonCount,
      riskIndex: Math.round(riskIndex * 100) / 100,
    };
  }).sort((a, b) => b.riskIndex - a.riskIndex);

  const absencesData = absencesRes.data;
  const absencesAvailable = !absencesRes.error && absencesData !== null;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let sickDays = 0;
  
  if (absencesAvailable) {
    for (const row of absencesData || []) {
      if (row.type === "sick") {
        const from = new Date(row.from_date);
        const to = new Date(row.to_date);
        if (to >= thirtyDaysAgo) {
          const effectiveFrom = from < thirtyDaysAgo ? thirtyDaysAgo : from;
          const effectiveTo = to > now ? now : to;
          const days = Math.ceil((effectiveTo.getTime() - effectiveFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1;
          sickDays += Math.max(0, days);
        }
      }
    }
  }

  const workingDaysInMonth = 22;
  const sickLeaveRatio = totalHeadcount > 0 
    ? (sickDays / (totalHeadcount * workingDaysInMonth)) * 100 
    : 0;

  const skillLevels: Record<string, number[]> = {};
  for (const row of skillsRes.data || []) {
    const skills = row.skills as unknown as { name: string } | null;
    const skillName = skills?.name || "Unknown";
    if (!skillLevels[skillName]) {
      skillLevels[skillName] = [0, 0, 0, 0, 0];
    }
    const level = row.level as number;
    if (level >= 0 && level <= 4) {
      skillLevels[skillName][level]++;
    }
  }
  const skillDistribution = Object.entries(skillLevels)
    .slice(0, 10)
    .map(([skillName, levels]) => ({
      skillName,
      levels,
    }));

  return {
    totalHeadcount,
    headcountByOrgUnit,
    headcountByEmploymentType,
    sickLeaveRatio: Math.round(sickLeaveRatio * 100) / 100,
    temporaryContractsEndingSoon,
    temporaryContractsEndingList,
    criticalEventsCount,
    criticalEventsByStatus: { overdue: overdueCount, dueSoon: dueSoonCount },
    skillDistribution,
    riskIndexByUnit,
    absencesAvailable,
  };
}

export async function getAbsenceSummary(fromDate: string, toDate: string): Promise<{
  totalAbsences: number;
  byType: { type: string; count: number }[];
}> {
  const { data, error } = await supabase
    .from("absences")
    .select("id, type")
    .gte("from_date", fromDate)
    .lte("to_date", toDate);

  if (error) {
    console.error("Error fetching absences:", error);
    return { totalAbsences: 0, byType: [] };
  }

  const typeCounts: Record<string, number> = {};
  (data || []).forEach((row) => {
    typeCounts[row.type] = (typeCounts[row.type] || 0) + 1;
  });

  return {
    totalAbsences: data?.length || 0,
    byType: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
  };
}
