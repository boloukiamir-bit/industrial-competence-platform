import { supabase } from "@/lib/supabaseClient";
import type { HRAnalytics } from "@/types/domain";

export async function getHRAnalytics(): Promise<HRAnalytics> {
  const [
    headcountRes,
    orgUnitRes,
    employmentTypeRes,
    absencesRes,
    tempContractsRes,
    criticalEventsRes,
    skillsRes,
  ] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
    
    supabase
      .from("employees")
      .select("org_unit_id, org_units(name)")
      .eq("is_active", true),
    
    supabase
      .from("employees")
      .select("employment_type")
      .eq("is_active", true),
    
    supabase
      .from("absences")
      .select("id, type, from_date, to_date"),
    
    supabase
      .from("employees")
      .select("id")
      .eq("is_active", true)
      .eq("employment_type", "temporary")
      .not("contract_end_date", "is", null)
      .lte("contract_end_date", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
    
    supabase
      .from("person_events")
      .select("category, status")
      .in("status", ["due_soon", "overdue"]),
    
    supabase
      .from("employee_skills")
      .select("level, skills(name)")
      .order("level"),
  ]);

  const totalHeadcount = headcountRes.count || 0;

  const orgUnitCounts: Record<string, number> = {};
  (orgUnitRes.data || []).forEach((row) => {
    const orgUnits = row.org_units as unknown as { name: string } | null;
    const unitName = orgUnits?.name || "Unassigned";
    orgUnitCounts[unitName] = (orgUnitCounts[unitName] || 0) + 1;
  });
  const headcountByOrgUnit = Object.entries(orgUnitCounts).map(([orgUnitName, count]) => ({
    orgUnitName,
    count,
  }));

  const employmentTypeCounts: Record<string, number> = {};
  (employmentTypeRes.data || []).forEach((row) => {
    const type = row.employment_type || "unknown";
    employmentTypeCounts[type] = (employmentTypeCounts[type] || 0) + 1;
  });
  const headcountByEmploymentType = Object.entries(employmentTypeCounts).map(([type, count]) => ({
    type,
    count,
  }));

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let sickDays = 0;
  (absencesRes.data || []).forEach((row) => {
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
  });

  const workingDaysInMonth = 22;
  const sickLeaveRatio = totalHeadcount > 0 
    ? (sickDays / (totalHeadcount * workingDaysInMonth)) * 100 
    : 0;

  const temporaryContractsEndingSoon = tempContractsRes.data?.length || 0;

  const criticalEventsCounts: Record<string, number> = {};
  (criticalEventsRes.data || []).forEach((row) => {
    criticalEventsCounts[row.category] = (criticalEventsCounts[row.category] || 0) + 1;
  });
  const criticalEventsCount = Object.entries(criticalEventsCounts).map(([category, count]) => ({
    category,
    count,
  }));

  const skillLevels: Record<string, number[]> = {};
  (skillsRes.data || []).forEach((row) => {
    const skills = row.skills as unknown as { name: string } | null;
    const skillName = skills?.name || "Unknown";
    if (!skillLevels[skillName]) {
      skillLevels[skillName] = [0, 0, 0, 0, 0];
    }
    const level = row.level as number;
    if (level >= 0 && level <= 4) {
      skillLevels[skillName][level]++;
    }
  });
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
    criticalEventsCount,
    skillDistribution,
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
