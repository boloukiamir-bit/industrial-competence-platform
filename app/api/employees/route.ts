import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("org_id");

    if (!orgId) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    // First try regular employees table
    const result = await pool.query(
      `SELECT id, name, email 
       FROM employees 
       WHERE org_id = $1 
       ORDER BY name 
       LIMIT 100`,
      [orgId]
    );

    // If no employees found and this is Spaljisten org, check sp_employees
    if (result.rows.length === 0 && orgId === SPALJISTEN_ORG_ID) {
      const spResult = await pool.query(
        `SELECT id, employee_name as name, email 
         FROM sp_employees 
         WHERE org_id = $1 
         ORDER BY employee_name 
         LIMIT 100`,
        [orgId]
      );
      return NextResponse.json({ employees: spResult.rows });
    }

    return NextResponse.json({ employees: result.rows });
  } catch (err) {
    console.error("GET /api/employees failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
