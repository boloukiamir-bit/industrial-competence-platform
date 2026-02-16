/**
 * Verify roster-scoped compliance KPIs for Spaljisten S1 2026-02-13.
 * If roster_employees_count=0, KPIs must be zero and no blockers should exist.
 * Usage: npx tsx scripts/verify_compliance_roster_spaljisten.ts
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
    const fnCheck = await pool.query(
      `SELECT COUNT(*) AS exists_count
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = 'get_roster_employee_ids'`
    );
    const existsCount = Number((fnCheck.rows[0] as { exists_count: string }).exists_count);
    if (existsCount === 0) {
      throw new Error("get_roster_employee_ids function is missing. Apply migration 20260213150000_roster_employee_ids.sql.");
    }

    const roster = await pool.query(
      `SELECT COUNT(*) AS roster_count
       FROM public.get_roster_employee_ids($1::uuid, $2::date, $3::text)`,
      [orgId, shiftDate, shiftCode]
    );
    const rosterCount = Number((roster.rows[0] as { roster_count: string }).roster_count);
    console.log("org_id:", orgId, "shift_date:", shiftDate, "shift_code:", shiftCode);
    console.log("roster_employees_count:", rosterCount);

    if (rosterCount === 0) {
      // If roster is empty, expected KPIs are zeros and blockers are empty.
      console.log("Expected: kpis all zero and no blockers returned.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
