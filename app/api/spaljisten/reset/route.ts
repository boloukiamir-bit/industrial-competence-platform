import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
export const runtime = "nodejs";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export async function DELETE(request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      await client.query("DELETE FROM sp_import_logs WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      await client.query("DELETE FROM sp_area_leaders WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      await client.query("DELETE FROM sp_employee_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      await client.query("DELETE FROM sp_employees WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      await client.query("DELETE FROM sp_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      await client.query("DELETE FROM sp_stations WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      await client.query("DELETE FROM sp_areas WHERE org_id = $1", [SPALJISTEN_ORG_ID]);
      
      await client.query("COMMIT");
      
      return NextResponse.json({ 
        success: true, 
        message: "Spaljisten dataset reset successfully. All areas, employees, skills, ratings cleared." 
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const [areasRes, employeesRes, skillsRes, ratingsRes, stationsRes] = await Promise.all([
        client.query("SELECT COUNT(*) as count FROM sp_areas WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT COUNT(*) as count FROM sp_employees WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT COUNT(*) as count FROM sp_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT COUNT(*) as count FROM sp_employee_skills WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
        client.query("SELECT COUNT(*) as count FROM sp_stations WHERE org_id = $1", [SPALJISTEN_ORG_ID]),
      ]);
      
      return NextResponse.json({
        areas: parseInt(areasRes.rows[0].count),
        stations: parseInt(stationsRes.rows[0].count),
        employees: parseInt(employeesRes.rows[0].count),
        skills: parseInt(skillsRes.rows[0].count),
        ratings: parseInt(ratingsRes.rows[0].count),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
