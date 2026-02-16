/**
 * Verify Cockpit station summary for Spaljisten seeded roster shift.
 * Usage: npx tsx scripts/verify_cockpit_spaljisten_unstaffed.ts
 * Env: DATABASE_URL, SPALJISTEN_ORG_ID (optional).
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal(): void {
  try {
    const envPath = join(__dirname, "..", ".env.local");
    const envFile = readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const raw = trimmed.slice(eq + 1).trim();
          const value = raw.replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch {
    /* ignore */
  }
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  const host = connectionString.replace(/^postgres(?:ql)?:\/\//, "").split("@")[1]?.split("/")[0] ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  let ssl: boolean | { rejectUnauthorized: boolean; ca?: string } = false;
  if (!isLocalhost) {
    const caB64 = process.env.SUPABASE_DB_CA_PEM_B64?.trim();
    if (caB64) {
      ssl = { ca: Buffer.from(caB64, "base64").toString("utf8"), rejectUnauthorized: true };
    } else if (process.env.DB_SMOKE_INSECURE_SSL === "1") {
      ssl = { rejectUnauthorized: false };
    } else {
      throw new Error("Set SUPABASE_DB_CA_PEM_B64 or DB_SMOKE_INSECURE_SSL=1");
    }
  }
  return new Pool({ connectionString, ssl });
}

async function main(): Promise<void> {
  loadEnvLocal();
  const orgId =
    process.env.SPALJISTEN_ORG_ID ?? "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const shiftDate = "2026-02-13";
  const shiftCode = "S1";

  const pool = getPool();
  try {
    const res = await pool.query(
      `
      SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE station_shift_status = 'UNSTAFFED') AS unstaffed_rows,
        COUNT(*) FILTER (WHERE assigned_employees_count = 0 AND station_shift_status <> 'UNSTAFFED') AS invalid_unstaffed,
        COUNT(*) FILTER (WHERE station_shift_status IN ('NO_GO','WARNING','GO')) AS staffed_status_rows
      FROM public.v_cockpit_station_summary
      WHERE org_id = $1 AND shift_date = $2 AND shift_code = $3
      `,
      [orgId, shiftDate, shiftCode]
    );
    const row = res.rows[0] as {
      total_rows: string;
      unstaffed_rows: string;
      invalid_unstaffed: string;
      staffed_status_rows: string;
    };
    console.log("org_id:", orgId, "shift_date:", shiftDate, "shift_code:", shiftCode);
    console.log("total_rows:", row.total_rows);
    console.log("unstaffed_rows:", row.unstaffed_rows);
    console.log("invalid_unstaffed:", row.invalid_unstaffed);
    console.log("staffed_status_rows:", row.staffed_status_rows);

    if (Number(row.total_rows) !== 22) {
      throw new Error(`Expected 22 rows, got ${row.total_rows}`);
    }
    if (Number(row.invalid_unstaffed) !== 0) {
      throw new Error(`Found non-UNSTAFFED rows with assigned_employees_count=0`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
