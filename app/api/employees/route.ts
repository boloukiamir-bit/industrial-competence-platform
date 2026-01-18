import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("org_id");

    if (!orgId) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id, name, email 
       FROM employees 
       WHERE org_id = $1 
       ORDER BY name 
       LIMIT 100`,
      [orgId]
    );

    return NextResponse.json({ employees: result.rows });
  } catch (err) {
    console.error("Employees fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch employees" },
      { status: 500 }
    );
  }
}
