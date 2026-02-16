/**
 * Verify Spaljisten roster assignments count equals active stations count.
 * Usage: npx tsx scripts/verify_spaljisten_roster.ts
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
    const counts = await pool.query(
      `
      WITH shift_ids AS (
        SELECT id
        FROM public.shifts
        WHERE org_id = $1 AND shift_date = $2 AND shift_code = $3
      ),
      assignments AS (
        SELECT COUNT(*) AS cnt
        FROM public.shift_assignments
        WHERE shift_id IN (SELECT id FROM shift_ids)
      ),
      stations AS (
        SELECT COUNT(*) AS cnt
        FROM public.stations
        WHERE org_id = $1 AND is_active = true
      )
      SELECT (SELECT cnt FROM assignments) AS assignments_count,
             (SELECT cnt FROM stations) AS stations_count
      `,
      [orgId, shiftDate, shiftCode]
    );
    const row = counts.rows[0] as { assignments_count: string; stations_count: string };
    const assignmentsCount = Number(row.assignments_count);
    const stationsCount = Number(row.stations_count);
    console.log("org_id:", orgId, "shift_date:", shiftDate, "shift_code:", shiftCode);
    console.log("assignments_count:", assignmentsCount);
    console.log("stations_count:", stationsCount);
    if (assignmentsCount !== stationsCount) {
      throw new Error(
        `Mismatch: assignments_count (${assignmentsCount}) != stations_count (${stationsCount})`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
