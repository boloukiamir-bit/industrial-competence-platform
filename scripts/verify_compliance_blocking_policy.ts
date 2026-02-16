/**
 * Verify compliance blocking policy for Zvonko + Per.
 * Usage: npx tsx scripts/verify_compliance_blocking_policy.ts
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
    const colCheck = await pool.query(
      `SELECT COUNT(*) AS exists_count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'compliance_catalog'
         AND column_name = 'is_blocking'`
    );
    const existsCount = Number((colCheck.rows[0] as { exists_count: string }).exists_count);
    if (existsCount === 0) {
      throw new Error("compliance_catalog.is_blocking is missing. Apply migration 20260213160000_compliance_catalog_is_blocking.sql.");
    }

    const res = await pool.query(
      `
      WITH catalog AS (
        SELECT id, code, name, is_blocking
        FROM public.compliance_catalog
        WHERE org_id = $1 AND is_active = true
      ),
      employees AS (
        SELECT id, name, employee_number
        FROM public.employees
        WHERE org_id = $1 AND is_active = true
          AND (LOWER(name) LIKE 'zvonko%' OR LOWER(name) LIKE 'per%')
      ),
      assigned AS (
        SELECT employee_id, compliance_id, valid_to, waived
        FROM public.employee_compliance
        WHERE org_id = $1
      ),
      matrix AS (
        SELECT
          e.id AS employee_id,
          e.name AS employee_name,
          c.id AS compliance_id,
          c.code,
          c.is_blocking,
          a.valid_to,
          COALESCE(a.waived, false) AS waived
        FROM employees e
        CROSS JOIN catalog c
        LEFT JOIN assigned a
          ON a.employee_id = e.id AND a.compliance_id = c.id
      ),
      statused AS (
        SELECT
          employee_id,
          employee_name,
          code,
          is_blocking,
          CASE
            WHEN waived THEN 'waived'
            WHEN valid_to IS NULL THEN 'missing'
            WHEN valid_to::date < CURRENT_DATE THEN 'expired'
            WHEN valid_to::date <= CURRENT_DATE + 30 THEN 'expiring'
            ELSE 'valid'
          END AS status
        FROM matrix
      )
      SELECT
        employee_name,
        COUNT(*) FILTER (WHERE is_blocking AND status IN ('missing','expired')) AS blocking_issues,
        COUNT(*) FILTER (WHERE NOT is_blocking AND status = 'missing') AS missing_nonblocking,
        COUNT(*) FILTER (WHERE status <> 'valid') AS nonvalid_total
      FROM statused
      GROUP BY employee_name
      ORDER BY employee_name
      `,
      [orgId]
    );

    for (const row of res.rows as Array<{ employee_name: string; blocking_issues: string; missing_nonblocking: string; nonvalid_total: string }>) {
      console.log(
        row.employee_name,
        "blocking_issues:",
        row.blocking_issues,
        "missing_nonblocking:",
        row.missing_nonblocking,
        "nonvalid_total:",
        row.nonvalid_total
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
