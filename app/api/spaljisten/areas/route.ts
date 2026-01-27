import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getRequestId } from "@/lib/server/requestId";

export const runtime = "nodejs";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const result = await pool.query(
      `SELECT area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name`,
      [SPALJISTEN_ORG_ID]
    );
    const res = NextResponse.json({ areas: result.rows });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (err) {
    console.error(`[${requestId}] Areas fetch error:`, err);
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : "Areas fetch failed" },
      { status: 500 }
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
