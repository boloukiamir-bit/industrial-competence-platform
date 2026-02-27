import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPgPool, getPoolSslDiagnostic } from "@/lib/db";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import {
  buildEmployeeScope,
  getEmployeeScopeSqlParams,
  EMPLOYEE_SCOPE_SITE_FRAGMENT,
} from "@/lib/server/employeeScope";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMPLOYMENT_STATUS_VALUES = ["ACTIVE", "INACTIVE", "TERMINATED"] as const;
type EmploymentStatus = (typeof EMPLOYMENT_STATUS_VALUES)[number];

type PostEmployeeBody = {
  first_name: string;
  last_name: string;
  employment_external_id?: string | null;
  employee_number?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  employment_form?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  hire_date?: string | null;
  employment_status?: EmploymentStatus;
  termination_date?: string | null;
};

function parseDate(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? str : null;
}

function validatePostBody(
  body: unknown
): { ok: true; data: PostEmployeeBody } | { ok: false; status: number; code: string; details: string[] } {
  if (body === null || typeof body !== "object") {
    return { ok: false, status: 400, code: "VALIDATION_ERROR", details: ["Body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const details: string[] = [];

  const first_name = typeof b.first_name === "string" ? b.first_name.trim() : "";
  const last_name = typeof b.last_name === "string" ? b.last_name.trim() : "";
  if (!first_name || !last_name) {
    details.push("first_name and last_name are required");
  }

  const employment_status =
    typeof b.employment_status === "string" && EMPLOYMENT_STATUS_VALUES.includes(b.employment_status as EmploymentStatus)
      ? (b.employment_status as EmploymentStatus)
      : "ACTIVE";
  if (b.employment_status === "ARCHIVED" || (typeof b.employment_status === "string" && b.employment_status === "ARCHIVED")) {
    return { ok: false, status: 400, code: "VALIDATION_ERROR", details: ["ARCHIVED cannot be set via API"] };
  }

  const contract_start_date = parseDate(b.contract_start_date);
  const contract_end_date = parseDate(b.contract_end_date);
  if (contract_start_date && contract_end_date) {
    if (new Date(contract_end_date) < new Date(contract_start_date)) {
      details.push("contract_end_date must be >= contract_start_date when both set");
    }
  }

  if (employment_status === "TERMINATED") {
    const term = b.termination_date === null || b.termination_date === undefined ? null : parseDate(b.termination_date);
    if (term === null || term === undefined) {
      details.push("termination_date is required when employment_status is TERMINATED");
    }
  }

  if (details.length > 0) {
    return { ok: false, status: 400, code: "VALIDATION_ERROR", details };
  }

  const employment_external_id =
    b.employment_external_id === null || b.employment_external_id === undefined
      ? null
      : typeof b.employment_external_id === "string"
        ? b.employment_external_id.trim() || null
        : null;
  const employee_number =
    b.employee_number === null || b.employee_number === undefined
      ? null
      : typeof b.employee_number === "string"
        ? b.employee_number.trim() || null
        : null;
  const email = b.email === null || b.email === undefined ? null : typeof b.email === "string" ? b.email.trim() || null : null;
  const phone = b.phone === null || b.phone === undefined ? null : typeof b.phone === "string" ? b.phone.trim() || null : null;
  const title = b.title === null || b.title === undefined ? null : typeof b.title === "string" ? b.title.trim() || null : null;
  const employment_form =
    b.employment_form === null || b.employment_form === undefined ? null : typeof b.employment_form === "string" ? b.employment_form.trim() || null : null;
  const hire_date = b.hire_date === null || b.hire_date === undefined ? null : parseDate(b.hire_date);
  const termination_date =
    b.termination_date === null || b.termination_date === undefined ? null : parseDate(b.termination_date);

  return {
    ok: true,
    data: {
      first_name,
      last_name,
      employment_external_id,
      employee_number,
      email,
      phone,
      title,
      employment_form,
      contract_start_date: contract_start_date ?? null,
      contract_end_date: contract_end_date ?? null,
      hire_date,
      employment_status,
      termination_date,
    },
  };
}

function toEmployeeDto(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name ?? "",
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    employeeNumber: row.employee_number ?? "",
    employmentExternalId: (row.employment_external_id as string | null) ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    role: row.role ?? "",
    line: row.line ?? "",
    team: row.team ?? "",
    employmentType: row.employment_type ?? "permanent",
    startDate: row.start_date ?? undefined,
    contractEndDate: row.contract_end_date ?? undefined,
    employmentForm: row.employment_form ?? undefined,
    contractStartDate: row.contract_start_date ?? undefined,
    employmentStatus: row.employment_status ?? "ACTIVE",
    hireDate: row.hire_date ?? undefined,
    terminationDate: row.termination_date ?? undefined,
    isActive: row.is_active !== false,
  };
}

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
    const lineCode = request.nextUrl.searchParams.get("lineCode")?.trim() || null;

    logDiag(requestId, {
      userIdPresent: true,
      orgIdPresent: true,
      siteIdPresent: org.activeSiteId != null,
      membership_role: membershipRole,
      queryPath: "employees",
    });

    const result = await pool.query(
      `SELECT id, name, first_name, last_name, employee_number, employment_external_id, email, phone, date_of_birth,
              role, line, line_code, team, employment_type, start_date, contract_end_date, manager_id,
              address, city, postal_code, country, is_active, employment_status, hire_date,
              employment_form, contract_start_date, site_id, org_unit_id
       FROM employees 
       WHERE org_id = $1
         AND (employment_status IS NULL OR employment_status != 'ARCHIVED')
         AND ${EMPLOYEE_SCOPE_SITE_FRAGMENT}
         AND ($3::text IS NULL OR $3 = '' OR line_code = $3)
       ORDER BY name 
       LIMIT 500`,
      [orgId, activeSiteId, lineCode]
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
      employmentExternalId: (row as { employment_external_id?: string | null }).employment_external_id ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      dateOfBirth: row.date_of_birth ?? undefined,
      role: row.role ?? "",
      line: row.line ?? "",
      lineCode: row.line_code ?? row.line ?? "",
      team: row.team ?? "",
      employmentType: row.employment_type ?? "permanent",
      startDate: row.start_date ?? undefined,
      contractEndDate: row.contract_end_date ?? undefined,
      employmentForm: (row as { employment_form?: string | null }).employment_form ?? undefined,
      contractStartDate: (row as { contract_start_date?: string | null }).contract_start_date ?? undefined,
      managerId: row.manager_id ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      postalCode: row.postal_code ?? undefined,
      country: row.country ?? "Sweden",
      isActive: row.is_active ?? true,
      employmentStatus: (row as { employment_status?: string }).employment_status ?? "ACTIVE",
      hireDate: (row as { hire_date?: string }).hire_date ?? undefined,
      siteId: (row as { site_id?: string | null }).site_id ?? undefined,
      orgUnitId: (row as { org_unit_id?: string | null }).org_unit_id ?? undefined,
    }));
    const res = NextResponse.json({
      employees,
      requestId,
      sourceLineField: "line_code",
    });
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
        hasCaPem: diag.hasCaPem,
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

/**
 * POST /api/employees — create employee (Admin/HR). Tenant-scoped. Audit logged.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json(
        { ok: false, error: auth.error, requestId },
        { status: auth.status }
      );
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      if (auth.debugHeader) res.headers.set("x-auth-debug", auth.debugHeader);
      return res;
    }

    const body = await request.json().catch(() => null);
    const validated = validatePostBody(body);
    if (!validated.ok) {
      const res = NextResponse.json(
        { ok: false, error: validated.code, details: validated.details, requestId },
        { status: validated.status }
      );
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const {
      first_name,
      last_name,
      employment_external_id,
      employee_number,
      email,
      phone,
      title,
      employment_form,
      contract_start_date,
      contract_end_date,
      hire_date,
      employment_status,
      termination_date,
    } = validated.data;

    const name = `${first_name} ${last_name}`.trim() || "Unnamed";
    const empNumber =
      employee_number ?? employment_external_id ?? `EMP-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const hireDate = hire_date ?? contract_start_date ?? new Date().toISOString().slice(0, 10);

    const { data: inserted, error: insertErr } = await supabaseAdmin.from("employees").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      employment_external_id: employment_external_id ?? null,
      employee_number: empNumber,
      name,
      first_name,
      last_name,
      email: email ?? null,
      phone: phone ?? null,
      role: title ?? null,
      employment_form: employment_form ?? null,
      contract_start_date: contract_start_date ?? null,
      contract_end_date: contract_end_date ?? null,
      hire_date: hireDate,
      status_changed_at: new Date().toISOString(),
      employment_status: employment_status ?? "ACTIVE",
      termination_date: employment_status === "TERMINATED" ? termination_date ?? null : null,
      is_active: true,
    }).select("id, name, first_name, last_name, employee_number, employment_external_id, email, phone, role, employment_form, contract_start_date, contract_end_date, employment_status, hire_date, termination_date, is_active").single();

    if (insertErr) {
      const code = (insertErr as { code?: string }).code ?? "INSERT_FAILED";
      const msg = insertErr.message ?? "Insert failed";
      const res = NextResponse.json(
        { ok: false, error: msg, code, requestId },
        { status: 500 }
      );
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const newEmployee = inserted as Record<string, unknown>;
    const idempotencyKey = `EMP_CREATE:${newEmployee.id}`;
    await supabaseAdmin.from("governance_events").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      actor_user_id: auth.userId,
      action: "EMPLOYEE_CREATE",
      target_type: "EMPLOYEE",
      target_id: String(newEmployee.id),
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["EMPLOYEE_LIFECYCLE"],
      meta: {
        employment_external_id: employment_external_id ?? undefined,
        employee_number: empNumber,
        name,
        contract_start_date: contract_start_date ?? undefined,
        contract_end_date: contract_end_date ?? undefined,
      },
      idempotency_key: idempotencyKey,
    });

    const dto = toEmployeeDto(newEmployee);
    const res = NextResponse.json({ ok: true, employee: dto }, { status: 201 });
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(
      { ok: false, error: "employees_create_failed", requestId, message: String(err) },
      { status: 500 }
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
