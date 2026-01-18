import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ORG_NAME = "Spaljisten";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const areaCode = searchParams.get("areaCode") || undefined;

    const client = await pool.connect();
    try {
      const [areasRes, employeesRes, skillsRes, ratingsRes, stationsRes] = await Promise.all([
        client.query("SELECT id, org_id, area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, employee_id, employee_name, area_id, is_active FROM sp_employees WHERE org_id = $1 AND is_active = true", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, skill_id, skill_name, category, station_id FROM sp_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, employee_id, skill_id, rating FROM sp_employee_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, area_id, station_code, station_name FROM sp_stations WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
      ]);

      const areas = areasRes.rows;
      const employees = employeesRes.rows;
      const skills = skillsRes.rows;
      const ratings = ratingsRes.rows;
      const stations = stationsRes.rows;
      
      const stationMap = new Map(stations.map((s) => [s.id, s]));

      const totalEmployees = employees.length;
      const totalSkills = skills.length;
      const totalAreas = areas.length;

      const independentRatings = ratings.filter((r) => r.rating !== null && r.rating >= 3);
      const totalRatings = ratings.filter((r) => r.rating !== null).length;
      const averageIndependentRate = totalRatings > 0 ? Math.round((independentRatings.length / totalRatings) * 100) : 0;

      const totalStations = stations.length;

      const kpis = { 
        totalEmployees, 
        totalSkills, 
        totalAreas,
        totalStations,
        totalRatings, 
        averageIndependentRate,
        orgName: ORG_NAME,
        orgId: SPALJISTEN_ORG_ID
      };

      const employeeMap = new Map(employees.map((e) => [e.employee_id, { name: e.employee_name, areaId: e.area_id }]));
      const areaMap = new Map(areas.map((a) => [a.id, a.area_name]));
      const areaCodeToIdMap = new Map(areas.map((a) => [a.area_code, a.id]));

      let filteredSkills = skills;
      let filteredRatings = ratings;
      
      if (areaCode) {
        const matchedAreaId = areaCodeToIdMap.get(areaCode);
        if (matchedAreaId) {
          const employeesInArea = new Set(
            employees.filter((e) => e.area_id === matchedAreaId).map((e) => e.employee_id)
          );
          filteredRatings = ratings.filter((r) => employeesInArea.has(r.employee_id));
          const skillsWithRatingsInArea = new Set(filteredRatings.map((r) => r.skill_id));
          filteredSkills = skills.filter((s) => skillsWithRatingsInArea.has(s.skill_id));
        }
      }

      const skillRisks: { skillId: string; skillName: string; category: string; independentCount: number; totalRated: number; riskLevel: string }[] = [];
      
      for (const skill of filteredSkills) {
        const skillRatings = filteredRatings.filter((r) => r.skill_id === skill.skill_id);
        
        const independentCount = skillRatings.filter((r) => r.rating !== null && r.rating >= 3).length;
        const totalRated = skillRatings.filter((r) => r.rating !== null).length;
        
        let riskLevel: "ok" | "warning" | "critical" = "ok";
        if (independentCount === 0) riskLevel = "critical";
        else if (independentCount < 2) riskLevel = "warning";

        skillRisks.push({
          skillId: skill.skill_id,
          skillName: skill.skill_name,
          category: skill.category || "general",
          independentCount,
          totalRated,
          riskLevel,
        });
      }

      const topRiskSkills = skillRisks
        .filter((s) => s.totalRated > 0)
        .sort((a, b) => {
          const order: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
          if (a.riskLevel !== b.riskLevel) return order[a.riskLevel] - order[b.riskLevel];
          return a.independentCount - b.independentCount;
        })
        .slice(0, 10);

      const skillGapData = filteredSkills.map((skill) => {
        const skillRatings = filteredRatings.filter((r) => r.skill_id === skill.skill_id);
        
        const independentCount = skillRatings.filter((r) => r.rating !== null && r.rating >= 3).length;
        const totalEmployeesForSkill = skillRatings.length;

        const employeeDetails = skillRatings.map((r) => {
          const emp = employeeMap.get(r.employee_id);
          return {
            employeeId: r.employee_id,
            employeeName: emp?.name || r.employee_id,
            areaName: emp?.areaId ? areaMap.get(emp.areaId) || "Unknown" : "Unknown",
            rating: r.rating,
          };
        });

        let riskLevel: "ok" | "warning" | "critical" = "ok";
        if (independentCount === 0) riskLevel = "critical";
        else if (independentCount < 2) riskLevel = "warning";

        return {
          skillId: skill.skill_id,
          skillName: skill.skill_name,
          category: skill.category || "general",
          independentCount,
          totalEmployees: totalEmployeesForSkill,
          employees: employeeDetails,
          riskLevel,
        };
      })
      .filter((s) => s.totalEmployees > 0)
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
        if (a.riskLevel !== b.riskLevel) return order[a.riskLevel] - order[b.riskLevel];
        return a.independentCount - b.independentCount;
      });

      const filterOptions = {
        areas: areas.map((a) => ({ id: a.id, areaCode: a.area_code, areaName: a.area_name })),
      };

      return NextResponse.json({ 
        kpis, 
        topRiskSkills, 
        skillGapTable: skillGapData, 
        filterOptions 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
