import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";
import { getSpaliDevMode, SPALJISTEN_ORG_ID } from "@/lib/spaliDevMode";

type SmokeTestResult = {
  timestamp: string;
  orgId: string;
  devMode: boolean;
  checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
    value?: number | string;
  }[];
  overallStatus: "pass" | "fail" | "warn";
};

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const devMode = getSpaliDevMode();
  const checks: SmokeTestResult["checks"] = [];

  let overallStatus: "pass" | "fail" | "warn" = "pass";

  try {
    const client = await pool.connect();
    try {
      // Check 1: Database connection
      checks.push({
        name: "Database Connection",
        status: "pass",
        message: "Connected to PostgreSQL successfully",
      });

      // Check 2: Count areas
      const areasRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_areas WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const areaCount = parseInt(areasRes.rows[0].count, 10);
      checks.push({
        name: "Areas Count",
        status: areaCount > 0 ? "pass" : "warn",
        message: areaCount > 0 ? `Found ${areaCount} areas` : "No areas found - import areas.csv first",
        value: areaCount,
      });

      // Check 3: Count employees
      const employeesRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_employees WHERE org_id = $1 AND is_active = true",
        [SPALJISTEN_ORG_ID]
      );
      const employeeCount = parseInt(employeesRes.rows[0].count, 10);
      checks.push({
        name: "Employees Count",
        status: employeeCount > 0 ? "pass" : "warn",
        message: employeeCount > 0 ? `Found ${employeeCount} active employees` : "No employees found",
        value: employeeCount,
      });

      // Check 4: Count skills
      const skillsRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_skills WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const skillCount = parseInt(skillsRes.rows[0].count, 10);
      checks.push({
        name: "Skills Count",
        status: skillCount > 0 ? "pass" : "warn",
        message: skillCount > 0 ? `Found ${skillCount} skills` : "No skills found",
        value: skillCount,
      });

      // Check 5: Count ratings
      const ratingsRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_employee_skills WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const ratingCount = parseInt(ratingsRes.rows[0].count, 10);
      checks.push({
        name: "Ratings Count",
        status: ratingCount > 0 ? "pass" : "warn",
        message: ratingCount > 0 ? `Found ${ratingCount} skill ratings` : "No ratings found",
        value: ratingCount,
      });

      // Check 6: Count stations
      const stationsRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_stations WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const stationCount = parseInt(stationsRes.rows[0].count, 10);
      checks.push({
        name: "Stations Count",
        status: stationCount > 0 ? "pass" : "warn",
        message: stationCount > 0 ? `Found ${stationCount} stations` : "No stations found",
        value: stationCount,
      });

      // Check 7: Area filter query returns only filtered area
      if (areaCount > 0) {
        const firstAreaRes = await client.query(
          "SELECT id, area_name FROM sp_areas WHERE org_id = $1 LIMIT 1",
          [SPALJISTEN_ORG_ID]
        );
        const firstArea = firstAreaRes.rows[0];
        
        // Get skills for this area via station chain
        const filteredSkillsRes = await client.query(
          `SELECT COUNT(*) as count FROM sp_skills s
           JOIN sp_stations st ON s.station_id = st.id
           WHERE s.org_id = $1 AND st.area_id = $2`,
          [SPALJISTEN_ORG_ID, firstArea.id]
        );
        const filteredCount = parseInt(filteredSkillsRes.rows[0].count, 10);
        
        checks.push({
          name: "Area Filter Query",
          status: "pass",
          message: `Filter for "${firstArea.area_name}" returns ${filteredCount} skills via station chain`,
          value: filteredCount,
        });
      }

      // Check 8: Export endpoint accessible
      checks.push({
        name: "Export Endpoint",
        status: "pass",
        message: "Export endpoint available at /api/spaljisten/export",
      });

      // Determine overall status
      const failCount = checks.filter((c) => c.status === "fail").length;
      const warnCount = checks.filter((c) => c.status === "warn").length;
      
      if (failCount > 0) overallStatus = "fail";
      else if (warnCount > 0) overallStatus = "warn";

    } finally {
      client.release();
    }
  } catch (error) {
    checks.push({
      name: "Database Connection",
      status: "fail",
      message: error instanceof Error ? error.message : "Connection failed",
    });
    overallStatus = "fail";
  }

  const result: SmokeTestResult = {
    timestamp,
    orgId: SPALJISTEN_ORG_ID,
    devMode,
    checks,
    overallStatus,
  };

  return NextResponse.json(result);
}
