import { supabase } from "@/lib/supabaseClient";
import {
  SPALJISTEN_ORG_ID,
  SPArea,
  SPStation,
  SPSkill,
  SPEmployee,
  DashboardKPIs,
  TopRiskStation,
  SkillGapData,
} from "@/types/spaljisten";

export async function getAreas(orgId: string = SPALJISTEN_ORG_ID): Promise<SPArea[]> {
  const { data, error } = await supabase
    .from("sp_areas")
    .select("id, org_id, area_code, area_name")
    .eq("org_id", orgId)
    .order("area_name");

  if (error) throw error;
  return (data || []).map((a) => ({
    id: a.id,
    orgId: a.org_id,
    areaCode: a.area_code,
    areaName: a.area_name,
  }));
}

export async function getStations(
  orgId: string = SPALJISTEN_ORG_ID,
  areaId?: string
): Promise<SPStation[]> {
  let query = supabase
    .from("sp_stations")
    .select("id, org_id, area_id, station_code, station_name, sort_order")
    .eq("org_id", orgId)
    .order("station_name");

  if (areaId) {
    query = query.eq("area_id", areaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((s) => ({
    id: s.id,
    orgId: s.org_id,
    areaId: s.area_id,
    stationCode: s.station_code,
    stationName: s.station_name,
    sortOrder: s.sort_order || 0,
  }));
}

export async function getSkills(
  orgId: string = SPALJISTEN_ORG_ID,
  stationId?: string
): Promise<SPSkill[]> {
  let query = supabase
    .from("sp_skills")
    .select("id, org_id, skill_id, skill_name, station_id, category, description, sort_order")
    .eq("org_id", orgId)
    .order("skill_name");

  if (stationId) {
    query = query.eq("station_id", stationId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((s) => ({
    id: s.id,
    orgId: s.org_id,
    skillId: s.skill_id,
    skillName: s.skill_name,
    stationId: s.station_id,
    category: s.category,
    description: s.description,
    sortOrder: s.sort_order || 0,
  }));
}

export async function getEmployees(
  orgId: string = SPALJISTEN_ORG_ID,
  areaId?: string
): Promise<SPEmployee[]> {
  let query = supabase
    .from("sp_employees")
    .select("id, org_id, employee_id, employee_name, email, area_id, employment_type, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("employee_name");

  if (areaId) {
    query = query.eq("area_id", areaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((e) => ({
    id: e.id,
    orgId: e.org_id,
    employeeId: e.employee_id,
    employeeName: e.employee_name,
    email: e.email,
    areaId: e.area_id,
    employmentType: e.employment_type,
    isActive: e.is_active,
  }));
}

export async function getDashboardKPIs(
  orgId: string = SPALJISTEN_ORG_ID
): Promise<DashboardKPIs> {
  const [employeesRes, stationsRes, skillsRes, ratingsRes] = await Promise.all([
    supabase
      .from("sp_employees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
    supabase
      .from("sp_stations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("sp_skills")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("sp_employee_skills")
      .select("rating")
      .eq("org_id", orgId)
      .gte("rating", 3),
  ]);

  const totalEmployees = employeesRes.count || 0;
  const totalStations = stationsRes.count || 0;
  const totalSkills = skillsRes.count || 0;

  const totalRatingsRes = await supabase
    .from("sp_employee_skills")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("rating", "is", null);

  const independentCount = ratingsRes.data?.length || 0;
  const totalRatings = totalRatingsRes.count || 1;
  const averageIndependentRate = Math.round((independentCount / totalRatings) * 100);

  return {
    totalEmployees,
    totalStations,
    totalSkills,
    averageIndependentRate,
  };
}

export async function getTopRiskStations(
  orgId: string = SPALJISTEN_ORG_ID,
  limit: number = 10
): Promise<TopRiskStation[]> {
  const { data: stations } = await supabase
    .from("sp_stations")
    .select("id, station_code, station_name")
    .eq("org_id", orgId);

  if (!stations || stations.length === 0) return [];

  const stationRisks: TopRiskStation[] = [];

  for (const station of stations) {
    const { data: skills } = await supabase
      .from("sp_skills")
      .select("skill_id")
      .eq("org_id", orgId)
      .eq("station_id", station.id);

    if (!skills || skills.length === 0) continue;

    const skillIds = skills.map((s) => s.skill_id);

    const { data: ratings } = await supabase
      .from("sp_employee_skills")
      .select("skill_id, rating")
      .eq("org_id", orgId)
      .in("skill_id", skillIds)
      .gte("rating", 3);

    const independentCount = ratings?.length || 0;
    const totalSkills = skills.length;
    const riskScore = totalSkills - independentCount;

    stationRisks.push({
      stationCode: station.station_code,
      stationName: station.station_name,
      independentCount,
      totalSkills,
      riskScore,
    });
  }

  return stationRisks
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}

export async function getSkillGapData(
  orgId: string = SPALJISTEN_ORG_ID,
  areaId?: string,
  stationId?: string
): Promise<SkillGapData[]> {
  let stationQuery = supabase
    .from("sp_stations")
    .select("id, station_code, station_name, area_id")
    .eq("org_id", orgId);

  if (areaId) {
    stationQuery = stationQuery.eq("area_id", areaId);
  }
  if (stationId) {
    stationQuery = stationQuery.eq("id", stationId);
  }

  const { data: stations } = await stationQuery;
  if (!stations || stations.length === 0) return [];

  const stationIds = stations.map((s) => s.id);

  const { data: skills } = await supabase
    .from("sp_skills")
    .select("id, skill_id, skill_name, station_id")
    .eq("org_id", orgId)
    .in("station_id", stationIds);

  if (!skills || skills.length === 0) return [];

  const { data: employees } = await supabase
    .from("sp_employees")
    .select("employee_id, employee_name")
    .eq("org_id", orgId)
    .eq("is_active", true);

  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e.employee_name]) || []);

  const skillIds = skills.map((s) => s.skill_id);
  const { data: ratings } = await supabase
    .from("sp_employee_skills")
    .select("employee_id, skill_id, rating")
    .eq("org_id", orgId)
    .in("skill_id", skillIds);

  const ratingsBySkill = new Map<string, { employeeId: string; rating: number | null }[]>();
  for (const r of ratings || []) {
    if (!ratingsBySkill.has(r.skill_id)) {
      ratingsBySkill.set(r.skill_id, []);
    }
    ratingsBySkill.get(r.skill_id)!.push({ employeeId: r.employee_id, rating: r.rating });
  }

  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const gapData: SkillGapData[] = [];

  for (const skill of skills) {
    const station = stationMap.get(skill.station_id);
    if (!station) continue;

    const skillRatings = ratingsBySkill.get(skill.skill_id) || [];
    const independentCount = skillRatings.filter((r) => r.rating !== null && r.rating >= 3).length;
    const totalEmployees = skillRatings.length;

    const employeeDetails = skillRatings.map((r) => ({
      employeeId: r.employeeId,
      employeeName: employeeMap.get(r.employeeId) || r.employeeId,
      rating: r.rating,
    }));

    let riskLevel: "ok" | "warning" | "critical" = "ok";
    if (independentCount === 0) {
      riskLevel = "critical";
    } else if (independentCount < 2) {
      riskLevel = "warning";
    }

    gapData.push({
      stationCode: station.station_code,
      stationName: station.station_name,
      skillId: skill.skill_id,
      skillName: skill.skill_name,
      independentCount,
      totalEmployees,
      employees: employeeDetails,
      riskLevel,
    });
  }

  return gapData.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) {
      const order = { critical: 0, warning: 1, ok: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    }
    return a.independentCount - b.independentCount;
  });
}

export async function getFilterOptions(orgId: string = SPALJISTEN_ORG_ID) {
  const [areas, stations] = await Promise.all([
    getAreas(orgId),
    getStations(orgId),
  ]);

  return { areas, stations };
}
