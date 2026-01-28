import { supabase } from "@/lib/supabaseClient";
import type { HRAnalytics, HRAnalyticsV2 } from "@/types/domain";

export async function getHRAnalytics(orgId: string): Promise<HRAnalytics> {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const employeesWithOrgRes = await supabase
    .from("employees")
    .select("id, name, role, employment_type, contract_end_date, line, team, org_unit_id")
    .eq("org_id", orgId)
    .eq("is_active", true);

  const employees = employeesWithOrgRes.data || [];
  const employeeIds = employees.map((e) => e.id);
  const employeeIdList = employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"];

  const [tempContractsRes, allEventsRes, skillsRes, absencesRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, role, contract_end_date")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .eq("employment_type", "temporary")
      .not("contract_end_date", "is", null)
      .lte("contract_end_date", ninetyDaysLater),
    employeeIdList[0] !== "00000000-0000-0000-0000-000000000000"
      ? supabase
          .from("person_events")
          .select("id, category, status, due_date, employee_id, employees:employee_id(line, team)")
          .in("employee_id", employeeIdList)
          .neq("status", "completed")
      : Promise.resolve({ data: [], error: null }),
    employeeIdList[0] !== "00000000-0000-0000-0000-000000000000"
      ? supabase
          .from("employee_skills")
          .select("level, skills(name)")
          .in("employee_id", employeeIdList)
          .order("level")
      : Promise.resolve({ data: [], error: null }),
    employeeIdList[0] !== "00000000-0000-0000-0000-000000000000"
      ? supabase
          .from("absences")
          .select("id, type, from_date, to_date")
          .in("employee_id", employeeIdList)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const totalHeadcount = employees.length;

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

export async function getHRAnalyticsV2(orgId: string): Promise<HRAnalyticsV2> {
  const baseAnalytics = await getHRAnalytics(orgId);
  const today = new Date();

  const employeesRes = await supabase
    .from("employees")
    .select("id, name, start_date, employment_type, contract_end_date")
    .eq("org_id", orgId)
    .eq("is_active", true);
  const employees = employeesRes.data || [];
  const employeeIds = employees.map((e) => e.id);
  const employeeIdList = employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"];

  const [workflowsRes, gapsRes] = await Promise.all([
    employeeIdList[0] !== "00000000-0000-0000-0000-000000000000"
      ? supabase
          .from("hr_workflow_instances")
          .select("template_id, template_name", { count: "exact" })
          .in("employee_id", employeeIdList)
          .eq("status", "active")
      : Promise.resolve({ data: [], count: 0, error: null }),
    supabase
      .from("competence_requirements")
      .select("line, skill_id, min_level, min_headcount, skills(name)"),
  ]);

  const tenureBands: Record<string, number> = { "0-1 years": 0, "1-3 years": 0, "3-5 years": 0, "5-10 years": 0, "10+ years": 0 };
  let totalTenure = 0;
  let attritionHighRisk = 0;
  let attritionMediumRisk = 0;
  const attritionEmployees: { id: string; name: string; riskLevel: 'high' | 'medium'; factors: string[] }[] = [];

  for (const emp of employees) {
    const factors: string[] = [];
    let riskScore = 0;

    if (emp.start_date) {
      const startDate = new Date(emp.start_date);
      const yearsEmployed = (today.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      totalTenure += yearsEmployed;

      if (yearsEmployed < 1) {
        tenureBands["0-1 years"]++;
        riskScore += 1;
        if (yearsEmployed < 0.5) {
          factors.push("New employee (<6 months)");
          riskScore += 1;
        }
      } else if (yearsEmployed < 3) {
        tenureBands["1-3 years"]++;
      } else if (yearsEmployed < 5) {
        tenureBands["3-5 years"]++;
      } else if (yearsEmployed < 10) {
        tenureBands["5-10 years"]++;
      } else {
        tenureBands["10+ years"]++;
      }
    } else {
      tenureBands["0-1 years"]++;
    }

    if (emp.employment_type === "temporary") {
      riskScore += 1;
      factors.push("Temporary contract");
      
      if (emp.contract_end_date) {
        const endDate = new Date(emp.contract_end_date);
        const daysUntilEnd = (endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
        if (daysUntilEnd < 30) {
          riskScore += 2;
          factors.push("Contract ending within 30 days");
        } else if (daysUntilEnd < 90) {
          riskScore += 1;
          factors.push("Contract ending within 90 days");
        }
      }
    }

    if (riskScore >= 3) {
      attritionHighRisk++;
      attritionEmployees.push({ id: emp.id, name: emp.name, riskLevel: 'high', factors });
    } else if (riskScore >= 2) {
      attritionMediumRisk++;
      attritionEmployees.push({ id: emp.id, name: emp.name, riskLevel: 'medium', factors });
    }
  }

  const avgTenureYears = employees.length > 0 ? Math.round((totalTenure / employees.length) * 10) / 10 : 0;

  const workflowTemplateCount: Record<string, { name: string; count: number }> = {};
  for (const row of workflowsRes.data || []) {
    const templateId = row.template_id as string;
    if (!workflowTemplateCount[templateId]) {
      workflowTemplateCount[templateId] = { name: row.template_name as string, count: 0 };
    }
    workflowTemplateCount[templateId].count++;
  }
  const openWorkflowsByTemplate = Object.entries(workflowTemplateCount).map(([templateId, data]) => ({
    templateId,
    templateName: data.name,
    count: data.count,
  }));

  let criticalGaps = 0;
  let trainingNeeded = 0;
  const wellStaffed = 0;

  criticalGaps = baseAnalytics.criticalEventsByStatus.overdue;
  trainingNeeded = baseAnalytics.criticalEventsByStatus.dueSoon;

  return {
    ...baseAnalytics,
    attritionRisk: {
      highrisk: attritionHighRisk,
      mediumRisk: attritionMediumRisk,
      employees: attritionEmployees.slice(0, 10),
    },
    tenureBands: Object.entries(tenureBands).map(([band, count]) => ({ band, count })),
    avgTenureYears,
    openWorkflowsByTemplate,
    skillGapSummary: { criticalGaps, trainingNeeded, wellStaffed },
  };
}
