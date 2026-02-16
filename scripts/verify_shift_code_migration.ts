/**
 * Verifications for shifts.shift_code migration.
 * Usage: npx tsx scripts/verify_shift_code_migration.ts
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
  const pool = getPool();

  try {
    console.log("--- bad_rows count (shift_code NULL/empty) ---");
    const bad = await pool.query(
      "SELECT COUNT(*) AS bad_rows FROM public.shifts WHERE shift_code IS NULL OR shift_code = ''"
    );
    console.log("bad_rows:", (bad.rows[0] as { bad_rows: string }).bad_rows);

    console.log("\n--- duplicates (org_id, shift_date, shift_code) ---");
    const dupes = await pool.query(
      `SELECT org_id, shift_date, shift_code, COUNT(*) AS cnt
       FROM public.shifts
       GROUP BY org_id, shift_date, shift_code
       HAVING COUNT(*) > 1
       ORDER BY cnt DESC
       LIMIT 20`
    );
    if (dupes.rows.length === 0) {
      console.log("duplicates: 0 rows");
    } else {
      dupes.rows.forEach((r) => {
        const row = r as { org_id: string; shift_date: string; shift_code: string; cnt: string };
        console.log(row.org_id, row.shift_date, row.shift_code, row.cnt);
      });
    }

    console.log("\n--- Spaljisten check (org_id/date -> shift_code=Day) ---");
    const dayRows = await pool.query(
      `SELECT COUNT(*) AS day_rows
       FROM public.shifts
       WHERE org_id = $1 AND shift_date = '2026-01-30' AND shift_code = 'Day'`,
      [orgId]
    );
    console.log("org_id:", orgId, "day_rows:", (dayRows.rows[0] as { day_rows: string }).day_rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
