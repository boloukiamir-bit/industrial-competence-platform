import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getRequestId } from "@/lib/server/requestId";
import { pool } from "@/lib/db/pool";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// Dev-only instrumentation flag
const DEV_LOG = process.env.NODE_ENV !== "production";

// Check if running in production environment
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

// Timezone for date calculations (Europe/Stockholm)
const ORG_TIMEZONE = "Europe/Stockholm";

/**
 * Get today's date in Europe/Stockholm timezone as YYYY-MM-DD string.
 * Uses date-only arithmetic to avoid timezone drift.
 */
export function getTodayInOrgTimezone(): string {
  // Get current time and format in Stockholm timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA format is YYYY-MM-DD
  return formatter.format(now);
}

/**
 * Calculate days difference between two date strings (YYYY-MM-DD).
 * Both dates are treated as date-only (no time component).
 */
export function daysBetween(dateStr1: string, dateStr2: string): number {
  // Parse as UTC midnight to avoid timezone issues
  const date1 = new Date(dateStr1 + "T00:00:00.000Z");
  const date2 = new Date(dateStr2 + "T00:00:00.000Z");
  const diffMs = date1.getTime() - date2.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Normalize a date value (Date, string, or Date object) to YYYY-MM-DD string.
 * Handles timestamptz by extracting date-only portion.
 */
export function normalizeToDateString(dateValue: Date | string): string {
  let date: Date;
  if (typeof dateValue === "string") {
    // If it's already YYYY-MM-DD, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Parse the string (could be ISO timestamp)
    date = new Date(dateValue);
  } else {
    date = dateValue;
  }
  
  // Extract date components in UTC to avoid timezone drift
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type ExpiringTask = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  type: "medical" | "cert";
  item_name: string;
  expires_on: string;
  days_to_expiry: number;
  severity: "P0" | "P1" | "P2";
};

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    // Authenticate and get org session
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const payload: Record<string, unknown> = { error: session.error };
      if (process.env.NODE_ENV !== "production") {
        payload.step = "getOrgIdFromSession";
      }
      const res = NextResponse.json(payload, { status: session.status });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Verify user has access to HR tasks (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const payload: Record<string, unknown> = { error: "Forbidden: HR admin access required" };
      if (process.env.NODE_ENV !== "production") {
        payload.step = "role_check";
      }
      const res = NextResponse.json(payload, { status: 403 });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    const userId = session.userId;
    if (orgId == null || orgId === undefined) {
      if (DEV_LOG) {
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        console.log(`[${requestId}] Missing orgId - cookies:`, allCookies.map((c) => ({ name: c.name, hasValue: !!c.value })));
      }
      const res = NextResponse.json({ error: "Missing org" }, { status: 401 });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Calculate cutoff date (30 days from today in org timezone)
    const todayStr = getTodayInOrgTimezone();
    const todayDate = new Date(todayStr + "T00:00:00.000Z");
    const thirtyDaysFromNow = new Date(todayDate);
    thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);
    const cutoffISO = normalizeToDateString(thirtyDaysFromNow);

    // Check if includeSeed query parameter is provided (dev/demo mode only)
    const { searchParams } = new URL(request.url);
    const includeSeedParam = searchParams.get("includeSeed");
    const includeSeed = DEV_LOG && includeSeedParam === "true";

    // Dev-only instrumentation
    if (DEV_LOG) {
      const dbUrl = process.env.DATABASE_URL || "";
      const urlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\//);
      const dbInfo = urlMatch
        ? { hostname: urlMatch[3], port: urlMatch[4], username: urlMatch[1], password: "***" }
        : { hostname: "unknown", port: "unknown", username: "unknown", password: "***" };
      console.log(`[${requestId}] DEV_LOG: requestId=${requestId}`);
      console.log(`[${requestId}] DEV_LOG: orgId=${orgId}`);
      console.log(`[${requestId}] DEV_LOG: DATABASE_URL hostname=${dbInfo.hostname} port=${dbInfo.port} username=${dbInfo.username} password=${dbInfo.password}`);
      console.log(`[${requestId}] DEV_LOG: cutoff date=${cutoffISO}`);
      console.log(`[${requestId}] DEV_LOG: includeSeed=${includeSeed}`);
    }

    // Proven SQL query with date normalization and seed filtering
    // Backwards compatible: try with source filter, fallback if column doesn't exist
    const buildQuery = (includeSeedRows: boolean) => {
      const sourceFilter = includeSeedRows
        ? "" // Include all rows in dev mode when explicitly requested
        : "AND (pe.source IS NULL OR pe.source NOT IN ('seed', 'test'))"; // Exclude seed/test in normal mode

      return `
        SELECT
          pe.id,
          pe.employee_id,
          pe.title,
          pe.due_date::date as due_date,
          e.name as employee_name
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        WHERE e.org_id = $1
          AND pe.category = $2
          AND pe.due_date IS NOT NULL
          AND pe.due_date::date <= $3::date
          ${sourceFilter}
        ORDER BY pe.due_date ASC
      `;
    };

    // Fetch expiring medical checks and certificates using proven SQL
    // Fail-closed in production: if source column is missing, return 500 error
    let medicalRows, certRows;
    try {
      const sql = buildQuery(includeSeed);
      medicalRows = await pool.query(sql, [orgId, "medical_check", cutoffISO]);
      certRows = await pool.query(sql, [orgId, "certificate", cutoffISO]);
    } catch (err: any) {
      // Check if error is due to missing source column (Postgres undefined_column 42703)
      const isMissingColumnError =
        String(err?.code) === "42703" ||
        (String(err?.message || "").includes("column") && String(err?.message || "").includes("source"));

      if (isMissingColumnError) {
        if (IS_PRODUCTION) {
          // Fail-closed in production: schema must be up to date
          console.error(
            `[${requestId}] PRODUCTION ERROR: person_events.source column missing. orgId=${orgId} errorCode=${err?.code}`
          );
          const res = NextResponse.json(
            { error: "Schema out of date: person_events.source missing. Please run database migrations." },
            { status: 500 }
          );
          res.headers.set("X-Request-Id", requestId);
          applySupabaseCookies(res, pendingCookies);
          return res;
        } else {
          // Dev mode: fallback but log loud warning
          console.warn(
            `[${requestId}] ⚠️  WARNING: person_events.source column not found! Using fallback (includes all rows). ` +
              `This is unsafe in production. Run migration: 20260129000000_add_source_to_person_events.sql`
          );
          console.warn(`[${requestId}] DEV_LOG: source column not found, using fallback query (backwards compatible)`);
          const fallbackSQL = buildQuery(true); // Include all rows when column doesn't exist
          medicalRows = await pool.query(fallbackSQL, [orgId, "medical_check", cutoffISO]);
          certRows = await pool.query(fallbackSQL, [orgId, "certificate", cutoffISO]);
        }
      } else {
        // Other database errors - rethrow
        throw err;
      }
    }

    if (DEV_LOG) {
      console.log(`[${requestId}] DEV_LOG: medicalRows.length=${medicalRows.rows.length}`);
      console.log(`[${requestId}] DEV_LOG: certRows.length=${certRows.rows.length}`);
    }

    const tasks: ExpiringTask[] = [];

    // Map medical rows with date normalization
    for (const row of medicalRows.rows) {
      const rawDueDate = row.due_date;
      const expiresOn = normalizeToDateString(rawDueDate);
      const daysToExpiry = daysBetween(expiresOn, todayStr);
      
      // Severity rules: <0 => P0, 0..7 => P1, 8..30 => P2, >30 => omit (filtered by cutoff)
      let severity: "P0" | "P1" | "P2";
      if (daysToExpiry < 0) severity = "P0";
      else if (daysToExpiry <= 7) severity = "P1";
      else severity = "P2";
      
      if (DEV_LOG) {
        console.log(`[${requestId}] DEV_LOG: medical task id=${row.id} raw_due_date=${rawDueDate} expires_on=${expiresOn} days_to_expiry=${daysToExpiry}`);
      }
      
      tasks.push({
        id: row.id,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        type: "medical",
        item_name: row.title,
        expires_on: expiresOn,
        days_to_expiry: daysToExpiry,
        severity,
      });
    }

    // Map certificate rows with date normalization
    for (const row of certRows.rows) {
      const rawDueDate = row.due_date;
      const expiresOn = normalizeToDateString(rawDueDate);
      const daysToExpiry = daysBetween(expiresOn, todayStr);
      
      // Severity rules: <0 => P0, 0..7 => P1, 8..30 => P2, >30 => omit (filtered by cutoff)
      let severity: "P0" | "P1" | "P2";
      if (daysToExpiry < 0) severity = "P0";
      else if (daysToExpiry <= 7) severity = "P1";
      else severity = "P2";
      
      if (DEV_LOG) {
        console.log(`[${requestId}] DEV_LOG: cert task id=${row.id} raw_due_date=${rawDueDate} expires_on=${expiresOn} days_to_expiry=${daysToExpiry}`);
      }
      
      tasks.push({
        id: row.id,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        type: "cert",
        item_name: row.title,
        expires_on: expiresOn,
        days_to_expiry: daysToExpiry,
        severity,
      });
    }

    tasks.sort((a, b) => {
      const severityOrder = { P0: 0, P1: 1, P2: 2 };
      const d = severityOrder[a.severity] - severityOrder[b.severity];
      if (d !== 0) return d;
      return a.days_to_expiry - b.days_to_expiry;
    });

    const medicalCount = tasks.filter((t) => t.type === "medical").length;
    const certCount = tasks.filter((t) => t.type === "cert").length;

    const res = NextResponse.json({
      tasks,
      meta: { medical_count: medicalCount, cert_count: certCount, total_count: tasks.length },
    });
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error(`[${requestId}] GET /api/hr/tasks failed:`, err);
    const res = NextResponse.json({ error: "Internal error" }, { status: 500 });
    res.headers.set("X-Request-Id", requestId);
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      /* ignore cookie errors on error path */
    }
    return res;
  }
}

/**
 * Dev-only self-check function for date normalization.
 * Call this manually in dev mode to verify date handling is correct.
 */
export function devSelfCheckDateNormalization(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log("[DEV] Date normalization self-check:");
  
  const today = getTodayInOrgTimezone();
  console.log(`  Today (${ORG_TIMEZONE}): ${today}`);
  
  // Test various date formats
  const testCases = [
    { input: "2026-01-31", desc: "YYYY-MM-DD string" },
    { input: "2026-01-31T23:00:00.000Z", desc: "ISO timestamp (evening)" },
    { input: "2026-01-31T00:00:00.000Z", desc: "ISO timestamp (midnight)" },
    { input: new Date("2026-01-31T12:00:00.000Z"), desc: "Date object" },
  ];
  
  for (const testCase of testCases) {
    const normalized = normalizeToDateString(testCase.input);
    const days = daysBetween(normalized, today);
    console.log(`  ${testCase.desc}: ${testCase.input} -> ${normalized} (${days} days from today)`);
  }
  
  // Test severity calculation
  const severityTests = [
    { days: -1, expected: "P0" },
    { days: 0, expected: "P1" },
    { days: 7, expected: "P1" },
    { days: 8, expected: "P2" },
    { days: 30, expected: "P2" },
  ];
  
  console.log("  Severity rules:");
  for (const test of severityTests) {
    let severity: "P0" | "P1" | "P2";
    if (test.days < 0) severity = "P0";
    else if (test.days <= 7) severity = "P1";
    else severity = "P2";
    const match = severity === test.expected ? "✓" : "✗";
    console.log(`    ${match} days=${test.days} -> ${severity} (expected ${test.expected})`);
  }
}
