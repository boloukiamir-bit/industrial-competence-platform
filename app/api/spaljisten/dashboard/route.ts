import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const areaId = searchParams.get("areaId") || undefined;
    const stationId = searchParams.get("stationId") || undefined;

    const client = await pool.connect();
    try {
      const [areasRes, stationsRes, employeesRes, skillsRes, ratingsRes] = await Promise.all([
        client.query("SELECT id, org_id, area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, area_id, station_code, station_name FROM sp_stations WHERE org_id = $1 ORDER BY station_name", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, employee_id, employee_name, is_active FROM sp_employees WHERE org_id = $1 AND is_active = true", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, skill_id, skill_name, station_id FROM sp_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, org_id, employee_id, skill_id, rating FROM sp_employee_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
      ]);

      const areas = areasRes.rows;
      const stations = stationsRes.rows;
      const employees = employeesRes.rows;
      const skills = skillsRes.rows;
      const ratings = ratingsRes.rows;

      const totalEmployees = employees.length;
      const totalStations = stations.length;
      const totalSkills = skills.length;

      const independentRatings = ratings.filter((r) => r.rating !== null && r.rating >= 3);
      const totalRatings = ratings.filter((r) => r.rating !== null).length;
      const averageIndependentRate = totalRatings > 0 ? Math.round((independentRatings.length / totalRatings) * 100) : 0;

      const kpis = { totalEmployees, totalStations, totalSkills, totalRatings, averageIndependentRate };

      const stationRisks: { stationCode: string; stationName: string; independentCount: number; totalSkills: number; riskScore: number }[] = [];
      for (const station of stations) {
        const stationSkills = skills.filter((s) => s.station_id === station.id);
        if (stationSkills.length === 0) continue;
        const skillIds = stationSkills.map((s) => s.skill_id);
        const stationRatings = ratings.filter((r) => skillIds.includes(r.skill_id) && r.rating !== null && r.rating >= 3);
        const independentCount = stationRatings.length;
        const riskScore = stationSkills.length - independentCount;
        stationRisks.push({
          stationCode: station.station_code,
          stationName: station.station_name,
          independentCount,
          totalSkills: stationSkills.length,
          riskScore,
        });
      }
      const topRiskStations = stationRisks.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

      let filteredStations = stations;
      if (areaId) filteredStations = filteredStations.filter((s) => s.area_id === areaId);
      if (stationId) filteredStations = filteredStations.filter((s) => s.id === stationId);

      const filteredStationIds = new Set(filteredStations.map((s) => s.id));
      const filteredSkills = skills.filter((s) => filteredStationIds.has(s.station_id));

      const stationMap = new Map(stations.map((s) => [s.id, s]));
      const employeeMap = new Map(employees.map((e) => [e.employee_id, e.employee_name]));

      const skillGapData = filteredSkills.map((skill) => {
        const station = stationMap.get(skill.station_id);
        const skillRatings = ratings.filter((r) => r.skill_id === skill.skill_id);
        const independentCount = skillRatings.filter((r) => r.rating !== null && r.rating >= 3).length;
        const totalEmployeesForSkill = skillRatings.length;

        const employeeDetails = skillRatings.map((r) => ({
          employeeId: r.employee_id,
          employeeName: employeeMap.get(r.employee_id) || r.employee_id,
          rating: r.rating,
        }));

        let riskLevel: "ok" | "warning" | "critical" = "ok";
        if (independentCount === 0) riskLevel = "critical";
        else if (independentCount < 2) riskLevel = "warning";

        return {
          stationCode: station?.station_code || "N/A",
          stationName: station?.station_name || "Unknown",
          skillId: skill.skill_id,
          skillName: skill.skill_name,
          independentCount,
          totalEmployees: totalEmployeesForSkill,
          employees: employeeDetails,
          riskLevel,
        };
      }).sort((a, b) => {
        const order: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
        if (a.riskLevel !== b.riskLevel) return order[a.riskLevel] - order[b.riskLevel];
        return a.independentCount - b.independentCount;
      });

      const filterOptions = {
        areas: areas.map((a) => ({ id: a.id, areaCode: a.area_code, areaName: a.area_name })),
        stations: stations.map((s) => ({ id: s.id, stationCode: s.station_code, stationName: s.station_name, areaId: s.area_id })),
      };

      return NextResponse.json({ kpis, topRiskStations, skillGapTable: skillGapData, filterOptions });
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
