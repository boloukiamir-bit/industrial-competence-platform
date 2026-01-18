import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function normalizeAreaCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const areasRes = await client.query(
      "SELECT id, area_code, area_name FROM sp_areas WHERE org_id = $1",
      [SPALJISTEN_ORG_ID]
    );

    const areas = areasRes.rows as { id: string; area_code: string; area_name: string }[];
    
    const areaNameMap = new Map<string, { keptId: string; keptCode: string; duplicateIds: string[] }>();
    
    for (const area of areas) {
      const normalizedName = area.area_name.trim().toLowerCase();
      const normalizedCode = normalizeAreaCode(area.area_code);
      
      if (!areaNameMap.has(normalizedName)) {
        areaNameMap.set(normalizedName, { keptId: area.id, keptCode: area.area_code, duplicateIds: [] });
      } else {
        const existing = areaNameMap.get(normalizedName)!;
        const existingNormalized = normalizeAreaCode(existing.keptCode);
        
        if (area.area_code === normalizedCode && existing.keptCode !== existingNormalized) {
          existing.duplicateIds.push(existing.keptId);
          existing.keptId = area.id;
          existing.keptCode = area.area_code;
        } else {
          existing.duplicateIds.push(area.id);
        }
      }
    }

    let stationsUpdated = 0;
    let employeesUpdated = 0;
    let areasDeleted = 0;

    for (const [, data] of areaNameMap) {
      if (data.duplicateIds.length === 0) continue;

      for (const dupId of data.duplicateIds) {
        const stationsResult = await client.query(
          "UPDATE sp_stations SET area_id = $1 WHERE area_id = $2 AND org_id = $3",
          [data.keptId, dupId, SPALJISTEN_ORG_ID]
        );
        stationsUpdated += stationsResult.rowCount || 0;

        const employeesResult = await client.query(
          "UPDATE sp_employees SET area_id = $1 WHERE area_id = $2 AND org_id = $3",
          [data.keptId, dupId, SPALJISTEN_ORG_ID]
        );
        employeesUpdated += employeesResult.rowCount || 0;

        await client.query(
          "DELETE FROM sp_areas WHERE id = $1 AND org_id = $2",
          [dupId, SPALJISTEN_ORG_ID]
        );
        areasDeleted++;
      }
    }

    await client.query("COMMIT");

    const finalCount = await client.query(
      "SELECT COUNT(*) as count FROM sp_areas WHERE org_id = $1",
      [SPALJISTEN_ORG_ID]
    );

    return NextResponse.json({
      success: true,
      message: "Duplicate areas cleaned up successfully",
      stats: {
        areasDeleted,
        stationsUpdated,
        employeesUpdated,
        finalAreaCount: parseInt(finalCount.rows[0].count)
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Dedupe error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Dedupe failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function GET() {
  const client = await pool.connect();
  
  try {
    const areasRes = await client.query(
      "SELECT id, area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name",
      [SPALJISTEN_ORG_ID]
    );

    const areas = areasRes.rows;
    const duplicates: { area_name: string; codes: string[] }[] = [];
    
    const nameGroups = new Map<string, string[]>();
    for (const area of areas) {
      const normalizedName = area.area_name.trim().toLowerCase();
      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, []);
      }
      nameGroups.get(normalizedName)!.push(area.area_code);
    }

    for (const [name, codes] of nameGroups) {
      if (codes.length > 1) {
        duplicates.push({ area_name: name, codes });
      }
    }

    return NextResponse.json({
      totalAreas: areas.length,
      duplicateGroups: duplicates.length,
      duplicates,
      areas: areas.map(a => ({ id: a.id, code: a.area_code, name: a.area_name }))
    });

  } finally {
    client.release();
  }
}
