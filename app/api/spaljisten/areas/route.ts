import { NextResponse } from "next/server";
import pool from "@/lib/pgClient";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name`,
      [SPALJISTEN_ORG_ID]
    );

    return NextResponse.json({ areas: result.rows });
  } catch (err) {
    console.error("Areas fetch error:", err);
    return NextResponse.json({ areas: [] });
  }
}
