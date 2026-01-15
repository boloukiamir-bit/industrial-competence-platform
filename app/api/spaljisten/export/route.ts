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
      const [stationsRes, skillsRes, ratingsRes, employeesRes, areasRes] = await Promise.all([
        client.query("SELECT id, area_id, station_code, station_name FROM sp_stations WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT skill_id, skill_name, station_id, category FROM sp_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT employee_id, skill_id, rating FROM sp_employee_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT employee_id, employee_name FROM sp_employees WHERE org_id = $1 AND is_active = true", [SPALJISTEN_ORG_ID]),
        client.query("SELECT id, area_code, area_name FROM sp_areas WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
      ]);

      const stations = stationsRes.rows;
      const skills = skillsRes.rows;
      const ratings = ratingsRes.rows;
      const employees = employeesRes.rows;
      const areas = areasRes.rows;

      const stationMap = new Map(stations.map((s) => [s.id, s]));
      const areaMap = new Map(areas.map((a) => [a.id, a.area_name]));

      const getSkillAreaId = (skill: { station_id: string | null }) => {
        if (!skill.station_id) return null;
        const station = stationMap.get(skill.station_id);
        return station?.area_id || null;
      };

      let filteredSkills = skills;
      if (areaId) {
        filteredSkills = skills.filter((skill) => getSkillAreaId(skill) === areaId);
      }
      if (stationId) {
        filteredSkills = filteredSkills.filter((s) => s.station_id === stationId);
      }

      const employeeMap = new Map(employees.map((e) => [e.employee_id, e.employee_name]));

      const gapData = filteredSkills.map((skill) => {
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
      });

      const headers = [
        "Station Code",
        "Station Name",
        "Skill ID",
        "Skill Name",
        "Independent Count (>=3)",
        "Total Employees",
        "Risk Level",
        "Employee Names",
      ];

      const rows = gapData.map((item) => [
        item.stationCode,
        item.stationName,
        item.skillId,
        item.skillName,
        item.independentCount.toString(),
        item.totalEmployees.toString(),
        item.riskLevel.toUpperCase(),
        item.employees.map((e) => `${e.employeeName} (${e.rating ?? "N"})`).join("; "),
      ]);

      const escapeCsvField = (field: string): string => {
        if (field.includes(",") || field.includes('"') || field.includes("\n")) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      const csvContent = [
        headers.map(escapeCsvField).join(","),
        ...rows.map((row) => row.map(escapeCsvField).join(",")),
      ].join("\n");

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `skill-gap-report-${timestamp}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
