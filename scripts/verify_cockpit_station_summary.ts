/**
 * Run three SQL verifications for v_cockpit_station_summary (org/date/shift).
 * If rows_total=0, run diagnostics to identify which filter eliminates rows.
 *
 * Usage: npx tsx scripts/verify_cockpit_station_summary.ts
 * Env: DATABASE_URL (required), COCKPIT_VERIFY_ORG_ID, COCKPIT_VERIFY_DATE, COCKPIT_VERIFY_SHIFT (optional)
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
  const orgId = process.env.COCKPIT_VERIFY_ORG_ID ?? "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const date = process.env.COCKPIT_VERIFY_DATE ?? "2026-01-30";
  const shiftCode = process.env.COCKPIT_VERIFY_SHIFT ?? "Day";

  const pool = getPool();

  try {
    console.log("--- 1) rows_total from v_cockpit_station_summary for org/date/shift ---");
    const q1 = await pool.query(
      `SELECT COUNT(*) AS rows_total FROM public.v_cockpit_station_summary WHERE org_id = $1 AND shift_date = $2 AND shift_code = $3`,
      [orgId, date, shiftCode]
    );
    const rowsTotal = Number((q1.rows[0] as { rows_total: string }).rows_total);
    console.log("org_id:", orgId);
    console.log("shift_date:", date, "shift_code:", shiftCode);
    console.log("rows_total:", rowsTotal);

    console.log("\n--- 2) Status distribution GROUP BY station_shift_status ---");
    const q2 = await pool.query(
      `SELECT station_shift_status, COUNT(*) AS cnt FROM public.v_cockpit_station_summary WHERE org_id = $1 AND shift_date = $2 AND shift_code = $3 GROUP BY station_shift_status ORDER BY station_shift_status`,
      [orgId, date, shiftCode]
    );
    if (q2.rows.length === 0) console.log("(no rows)");
    else q2.rows.forEach((r) => console.log((r as { station_shift_status: string; cnt: string }).station_shift_status, (r as { cnt: string }).cnt));

    console.log("\n--- 3) Raw assignment_rows JOIN shifts for org/date/shift ---");
    const q3 = await pool.query(
      `SELECT COUNT(*) AS raw_count FROM public.shift_assignments sa JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = sa.org_id WHERE sa.org_id = $1 AND sh.shift_date::text = $2 AND sh.shift_code = $3`,
      [orgId, date, shiftCode]
    );
    console.log("raw assignment_rows (sa JOIN sh) count:", (q3.rows[0] as { raw_count: string }).raw_count);

    if (rowsTotal === 0) {
      console.log("\n--- Diagnostics (rows_total=0): which filter removes rows? ---");
      const diag1 = await pool.query(
        `SELECT COUNT(*) AS n FROM public.shift_assignments sa JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = sa.org_id JOIN public.stations st ON st.id = sa.station_id AND st.org_id = sa.org_id AND st.is_active = true WHERE sa.org_id = $1 AND sh.shift_date::text = $2 AND sh.shift_code = $3`,
        [orgId, date, shiftCode]
      );
      console.log("After JOIN stations + is_active=true:", (diag1.rows[0] as { n: string }).n);

      const diag2 = await pool.query(
        `SELECT COUNT(*) AS n FROM public.shift_assignments sa JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = sa.org_id JOIN public.stations st ON st.id = sa.station_id AND st.org_id = sa.org_id AND st.is_active = true AND st.area_id IS NOT NULL WHERE sa.org_id = $1 AND sh.shift_date::text = $2 AND sh.shift_code = $3`,
        [orgId, date, shiftCode]
      );
      console.log("After + area_id IS NOT NULL:", (diag2.rows[0] as { n: string }).n);

      const shiftCodeCheck = await pool.query(
        `SELECT DISTINCT sh.shift_code FROM public.shifts sh WHERE sh.org_id = $1 AND sh.shift_date::text = $2`,
        [orgId, date]
      );
      console.log("Distinct shift_code in shifts for org/date:", shiftCodeCheck.rows.map((r) => (r as { shift_code: string }).shift_code));
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
