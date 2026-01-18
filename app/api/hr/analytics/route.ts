import { NextResponse } from "next/server";
import pool from "@/lib/pgClient";
import type { HRAnalyticsV2 } from "@/types/domain";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

async function getSpaljistenAnalytics(): Promise<HRAnalyticsV2> {
  try {
    const employeesResult = await pool.query(
      `SELECT e.id, e.employee_name as name, e.email, a.area_name 
       FROM sp_employees e 
       LEFT JOIN sp_areas a ON e.area_id = a.id
       WHERE e.org_id = $1`,
      [SPALJISTEN_ORG_ID]
    );
    const employees = employeesResult.rows;
    const totalHeadcount = employees.length;

    const areaData: Record<string, { count: number; permanent: number; temporary: number; consultant: number }> = {};
    for (const emp of employees) {
      const area = emp.area_name || "Unassigned";
      if (!areaData[area]) {
        areaData[area] = { count: 0, permanent: 0, temporary: 0, consultant: 0 };
      }
      areaData[area].count++;
      areaData[area].permanent++;
    }
    const headcountByOrgUnit = Object.entries(areaData).map(([orgUnitName, data]) => ({
      orgUnitName,
      count: data.count,
      permanent: data.permanent,
      temporary: data.temporary,
      consultant: data.consultant,
    }));

    const skillsResult = await pool.query(`
      SELECT 
        sk.skill_name,
        es.rating
      FROM sp_employee_skills es
      JOIN sp_skills sk ON es.skill_id = sk.skill_id
      WHERE es.org_id = $1
      ORDER BY sk.skill_name
    `, [SPALJISTEN_ORG_ID]);

    const skillLevels: Record<string, number[]> = {};
    for (const row of skillsResult.rows) {
      const skillName = row.skill_name || "Unknown";
      if (!skillLevels[skillName]) {
        skillLevels[skillName] = [0, 0, 0, 0, 0];
      }
      const level = row.rating as number;
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

    const riskResult = await pool.query(`
      SELECT 
        st.station_name,
        a.area_name,
        COUNT(DISTINCT CASE WHEN es.rating >= 3 THEN es.employee_id END) as independent_count
      FROM sp_stations st
      LEFT JOIN sp_areas a ON st.area_id = a.id
      LEFT JOIN sp_skills sk ON sk.station_id = st.id
      LEFT JOIN sp_employee_skills es ON es.skill_id = sk.skill_id
      WHERE st.org_id = $1
      GROUP BY st.station_name, a.area_name
    `, [SPALJISTEN_ORG_ID]);

    let overdueCount = 0;
    let dueSoonCount = 0;
    const criticalEventsCounts: Record<string, number> = {};

    for (const row of riskResult.rows) {
      const independentCount = parseInt(row.independent_count || "0", 10);
      if (independentCount === 0) {
        overdueCount++;
        criticalEventsCounts["Training"] = (criticalEventsCounts["Training"] || 0) + 1;
      } else if (independentCount < 2) {
        dueSoonCount++;
        criticalEventsCounts["Medical Check"] = (criticalEventsCounts["Medical Check"] || 0) + 1;
      }
    }

    const criticalEventsCount = Object.entries(criticalEventsCounts).map(([category, count]) => ({
      category,
      count,
    }));

    return {
      totalHeadcount,
      headcountByOrgUnit,
      headcountByEmploymentType: [{ type: "permanent", count: totalHeadcount }],
      sickLeaveRatio: 0,
      temporaryContractsEndingSoon: 0,
      temporaryContractsEndingList: [],
      criticalEventsCount,
      criticalEventsByStatus: { overdue: overdueCount, dueSoon: dueSoonCount },
      skillDistribution,
      riskIndexByUnit: headcountByOrgUnit.map(unit => ({
        unitName: unit.orgUnitName,
        headcount: unit.count,
        overdueCount: 0,
        dueSoonCount: 0,
        riskIndex: 0,
      })),
      absencesAvailable: false,
      attritionRisk: {
        highrisk: 0,
        mediumRisk: 0,
        employees: [],
      },
      tenureBands: [],
      avgTenureYears: 0,
      openWorkflowsByTemplate: [],
      skillGapSummary: { criticalGaps: overdueCount, trainingNeeded: dueSoonCount, wellStaffed: 0 },
    };
  } catch (err) {
    console.error("Spaljisten analytics error:", err);
    throw err;
  }
}

export async function GET() {
  try {
    const analytics = await getSpaljistenAnalytics();
    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
