import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPgPool, getPoolSslDiagnostic } from "@/lib/db";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import {
  buildEmployeeScope,
  getEmployeeScopeSqlParams,
  EMPLOYEE_SCOPE_SITE_FRAGMENT,
} from "@/lib/server/employeeScope";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const DEBUG = process.env.DEBUG_DIAGNOSTICS === "true";

function logDiag(requestId: string, data: Record<string, unknown>): void {
  if (DEBUG) {
    console.log(`[${requestId}] GET /api/employees DIAG`, JSON.stringify(data));
  }
}

/** DB/pg error shape (code, message, detail). */
function dbErrorFields(err: unknown): { code: string; message: string; hint?: string } {
  const o = err as { code?: string; message?: string; detail?: string };
  return {
    code: o?.code ?? "unknown",
    message: o?.message ?? String(err),
    ...(o?.detail != null && o.detail !== "" && { hint: o.detail }),
  };
}

/**
 * GET /api/employees — tenant-scoped by session (active_org_id),
 * optionally filtered by active_site_id when present. Uses shared employee scope so count matches Org Overview.
 * Always returns JSON; errors return { error, requestId, code, message, hint? } for diagnostics.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const pool = getPgPool();
  if (DEBUG) {
    const diag = getPoolSslDiagnostic();
    console.log(
      `[${requestId}] GET /api/employees pg: usedDbEnvKey=${diag.usedDbEnvKey} dbHost=${diag.dbHost} dbPort=${diag.dbPort} sslRejectUnauthorized=${diag.sslRejectUnauthorized}`
    );
  }
  let userIdPresent = false;
  let orgIdPresent = false;
  let siteIdPresent = false;

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      logDiag(requestId, {
        userIdPresent: false,
        orgIdPresent: false,
        siteIdPresent: false,
        queryPath: "none",
        error: org.error,
        status: org.status,
      });
      const res = NextResponse.json(
        { error: org.error, requestId },
        { status: org.status }
      );
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    userIdPresent = true;
    orgIdPresent = true;
    siteIdPresent = org.activeSiteId != null;

    let membershipRole: string | null = null;
    if (DEBUG) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: m } = await admin
        .from("memberships")
        .select("role")
        .eq("org_id", org.activeOrgId)
        .eq("user_id", org.userId)
        .eq("status", "active")
        .maybeSingle();
      membershipRole = (m as { role?: string } | null)?.role ?? null;
    }

    const scope = buildEmployeeScope({
      orgId: org.activeOrgId,
      activeSiteId: org.activeSiteId ?? null,
    });
    const [orgId, activeSiteId] = getEmployeeScopeSqlParams(scope);

    logDiag(requestId, {
      userIdPresent: true,
      orgIdPresent: true,
      siteIdPresent: org.activeSiteId != null,
      membership_role: membershipRole,
      queryPath: "employees",
    });

    const result = await pool.query(
      `SELECT id, name, first_name, last_name, employee_number, email, phone, date_of_birth,
              role, line, team, employment_type, start_date, contract_end_date, manager_id,
              address, city, postal_code, country, is_active
       FROM employees 
       WHERE org_id = $1
         AND is_active = true
         AND ${EMPLOYEE_SCOPE_SITE_FRAGMENT}
       ORDER BY name 
       LIMIT 500`,
      [orgId, activeSiteId]
    );

    if (result.rows.length === 0 && org.activeOrgId === SPALJISTEN_ORG_ID) {
      logDiag(requestId, { queryPath: "sp_employees" });
      const spResult = await pool.query(
        `SELECT id, employee_name as name, email 
         FROM sp_employees 
         WHERE org_id = $1 
         ORDER BY employee_name 
         LIMIT 100`,
        [org.activeOrgId]
      );
      const res = NextResponse.json({ employees: spResult.rows, requestId });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employees = result.rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      employeeNumber: row.employee_number ?? "",
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      dateOfBirth: row.date_of_birth ?? undefined,
      role: row.role ?? "",
      line: row.line ?? "",
      team: row.team ?? "",
      employmentType: row.employment_type ?? "permanent",
      startDate: row.start_date ?? undefined,
      contractEndDate: row.contract_end_date ?? undefined,
      managerId: row.manager_id ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      postalCode: row.postal_code ?? undefined,
      country: row.country ?? "Sweden",
      isActive: row.is_active ?? true,
    }));
    const res = NextResponse.json({ employees, requestId });
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    try {
      const { code, message, hint } = dbErrorFields(err);
      if (DEBUG) {
        logDiag(requestId, {
          userIdPresent,
          orgIdPresent,
          siteIdPresent,
          code,
          message,
          ...(hint != null && { hint }),
        });
      }
      const diag = getPoolSslDiagnostic();
      const payload = {
        error: "employees_failed",
        requestId,
        code,
        message,
        ...(hint != null && { hint }),
        usedDbEnvKey: diag.usedDbEnvKey,
        dbHost: diag.dbHost,
        dbPort: diag.dbPort,
        sslRejectUnauthorized: diag.sslRejectUnauthorized,
      };
      const res = NextResponse.json(payload, { status: 500 });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (_) {
      return NextResponse.json(
        { error: "employees_failed", requestId, code: "unknown", message: "Error serialization failed" },
        { status: 500 }
      );
    }
  }
}
