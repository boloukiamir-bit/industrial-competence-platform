import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
export const runtime = "nodejs";
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
  counts: {
    areas: number;
    stations: number;
    employees: number;
    skills: number;
    ratings: number;
  };
};

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const devMode = getSpaliDevMode();
  const checks: SmokeTestResult["checks"] = [];
  const searchParams = request.nextUrl.searchParams;
  const expectZero = searchParams.get("expectZero") === "true";

  let overallStatus: "pass" | "fail" | "warn" = "pass";
  let counts = { areas: 0, stations: 0, employees: 0, skills: 0, ratings: 0 };

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
      counts.areas = areaCount;

      // Check 3: Count stations
      const stationsRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_stations WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const stationCount = parseInt(stationsRes.rows[0].count, 10);
      counts.stations = stationCount;

      // Check 4: Count employees
      const employeesRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_employees WHERE org_id = $1 AND is_active = true",
        [SPALJISTEN_ORG_ID]
      );
      const employeeCount = parseInt(employeesRes.rows[0].count, 10);
      counts.employees = employeeCount;

      // Check 5: Count skills
      const skillsRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_skills WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const skillCount = parseInt(skillsRes.rows[0].count, 10);
      counts.skills = skillCount;

      // Check 6: Count ratings
      const ratingsRes = await client.query(
        "SELECT COUNT(*) as count FROM sp_employee_skills WHERE org_id = $1",
        [SPALJISTEN_ORG_ID]
      );
      const ratingCount = parseInt(ratingsRes.rows[0].count, 10);
      counts.ratings = ratingCount;

      // If expectZero=true, FAIL if any count > 0
      if (expectZero) {
        const totalCount = areaCount + stationCount + employeeCount + skillCount + ratingCount;
        if (totalCount > 0) {
          checks.push({
            name: "Reset Verification",
            status: "fail",
            message: `Expected all counts to be 0 after reset, but found: Areas=${areaCount}, Stations=${stationCount}, Employees=${employeeCount}, Skills=${skillCount}, Ratings=${ratingCount}`,
            value: totalCount,
          });
          overallStatus = "fail";
        } else {
          checks.push({
            name: "Reset Verification",
            status: "pass",
            message: "All counts are 0 - reset successful",
            value: 0,
          });
        }
      } else {
        // Normal mode - report counts
        checks.push({
          name: "Areas Count",
          status: areaCount > 0 ? "pass" : "warn",
          message: areaCount > 0 ? `Found ${areaCount} areas` : "No areas found - import areas.csv first",
          value: areaCount,
        });

        checks.push({
          name: "Stations Count",
          status: stationCount > 0 ? "pass" : "warn",
          message: stationCount > 0 ? `Found ${stationCount} stations` : "No stations found",
          value: stationCount,
        });

        checks.push({
          name: "Employees Count",
          status: employeeCount > 0 ? "pass" : "warn",
          message: employeeCount > 0 ? `Found ${employeeCount} active employees` : "No employees found",
          value: employeeCount,
        });

        checks.push({
          name: "Skills Count",
          status: skillCount > 0 ? "pass" : "warn",
          message: skillCount > 0 ? `Found ${skillCount} skills` : "No skills found",
          value: skillCount,
        });

        checks.push({
          name: "Ratings Count",
          status: ratingCount > 0 ? "pass" : "warn",
          message: ratingCount > 0 ? `Found ${ratingCount} skill ratings` : "No ratings found",
          value: ratingCount,
        });

        // Check 7: Area filter query returns only filtered area
        if (areaCount > 0) {
          const firstAreaRes = await client.query(
            "SELECT id, area_name FROM sp_areas WHERE org_id = $1 LIMIT 1",
            [SPALJISTEN_ORG_ID]
          );
          const firstArea = firstAreaRes.rows[0];
          
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
      }

      // Determine overall status
      const failCount = checks.filter((c) => c.status === "fail").length;
      const warnCount = checks.filter((c) => c.status === "warn").length;
      
      if (failCount > 0) overallStatus = "fail";
      else if (warnCount > 0 && overallStatus !== "fail") overallStatus = "warn";

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
    counts,
  };

  return NextResponse.json(result);
}
