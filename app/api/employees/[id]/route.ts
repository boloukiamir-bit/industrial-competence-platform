/**
 * GET /api/employees/[id] — tenant-scoped by session (active_org_id).
 * PATCH /api/employees/[id] — update employee. Tenant-scoped. No relational expansion; clean re-query.
 *
 * Curl examples (replace BASE_URL, TOKEN, EMPLOYEE_UUID):
 *   1) GET employee detail (tenant-scoped):
 *      curl -s -H "Authorization: Bearer TOKEN" -H "Cookie: sb-*-auth-token=..." "BASE_URL/api/employees/EMPLOYEE_UUID"
 *   2) PATCH update:
 *      curl -s -X PATCH -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"is_active":false}' "BASE_URL/api/employees/EMPLOYEE_UUID"
 */
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { auditWrite } from "@/lib/server/governance/auditWrite";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMPLOYMENT_TYPE_VALUES = ["permanent", "temporary", "consultant"] as const;
type EmploymentType = (typeof EMPLOYMENT_TYPE_VALUES)[number];

type PatchBody = {
  first_name?: string;
  last_name?: string;
  employee_number?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  is_active?: boolean;
  position_id?: string | null;
  employment_type?: EmploymentType;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  start_date?: string | null;
  // Master fields (Daniel HR v1)
  date_of_birth?: string | null;
  site_id?: string | null;
  org_unit_id?: string | null;
  manager_id?: string | null;
  team?: string | null;
  role?: string | null; // Role/Title -> employees.role
};

function parseDate(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? str : null;
}

function validatePatchBody(
  body: unknown
): { ok: true; updates: PatchBody } | { ok: false; code: string; details: string[] } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "VALIDATION_ERROR", details: ["Body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const details: string[] = [];
  const updates: PatchBody = {};

  if (b.first_name !== undefined) {
    updates.first_name = typeof b.first_name === "string" ? b.first_name : undefined;
    if (updates.first_name === undefined && b.first_name !== null) details.push("first_name must be string");
  }
  if (b.last_name !== undefined) {
    updates.last_name = typeof b.last_name === "string" ? b.last_name : undefined;
    if (updates.last_name === undefined && b.last_name !== null) details.push("last_name must be string");
  }
  if (b.employee_number !== undefined) {
    updates.employee_number = typeof b.employee_number === "string" ? b.employee_number : undefined;
    if (updates.employee_number === undefined && b.employee_number !== null) details.push("employee_number must be string");
  }
  if (b.email !== undefined) {
    updates.email = b.email === null ? null : typeof b.email === "string" ? b.email : undefined;
    if (updates.email === undefined && b.email !== null) details.push("email must be string or null");
  }
  if (b.phone !== undefined) {
    updates.phone = b.phone === null ? null : typeof b.phone === "string" ? b.phone : undefined;
    if (updates.phone === undefined && b.phone !== null) details.push("phone must be string or null");
  }
  if (b.title !== undefined) {
    updates.title = b.title === null ? null : typeof b.title === "string" ? b.title : undefined;
    if (updates.title === undefined && b.title !== null) details.push("title must be string or null");
  }
  if (b.is_active !== undefined) {
    if (typeof b.is_active === "boolean") updates.is_active = b.is_active;
    else details.push("is_active must be boolean");
  }
  if (b.position_id !== undefined) {
    updates.position_id =
      b.position_id === null || b.position_id === ""
        ? null
        : typeof b.position_id === "string"
          ? b.position_id
          : undefined;
    if (updates.position_id === undefined && b.position_id !== null && b.position_id !== "")
      details.push("position_id must be string or null");
  }
  if (b.employment_type !== undefined) {
    const v =
      typeof b.employment_type === "string" && EMPLOYMENT_TYPE_VALUES.includes(b.employment_type as EmploymentType)
        ? (b.employment_type as EmploymentType)
        : undefined;
    if (v !== undefined) updates.employment_type = v;
    else details.push("employment_type must be one of: permanent, temporary, consultant");
  }
  if (b.contract_start_date !== undefined) {
    const v =
      b.contract_start_date === null ||
      (typeof b.contract_start_date === "string" && b.contract_start_date.trim() === "")
        ? null
        : parseDate(b.contract_start_date);
    if (v !== undefined) updates.contract_start_date = v;
    else if (b.contract_start_date !== null && b.contract_start_date !== undefined)
      details.push("contract_start_date must be a valid date or null");
  }
  if (b.contract_end_date !== undefined) {
    const v =
      b.contract_end_date === null ||
      (typeof b.contract_end_date === "string" && b.contract_end_date.trim() === "")
        ? null
        : parseDate(b.contract_end_date);
    if (v !== undefined) updates.contract_end_date = v;
    else if (b.contract_end_date !== null && b.contract_end_date !== undefined)
      details.push("contract_end_date must be a valid date or null");
  }
  if (b.start_date !== undefined) {
    const v =
      b.start_date === null || (typeof b.start_date === "string" && b.start_date.trim() === "")
        ? null
        : parseDate(b.start_date);
    if (v !== undefined) updates.start_date = v;
    else if (b.start_date !== null && b.start_date !== undefined)
      details.push("start_date must be a valid date or null");
  }
  if (b.hire_date !== undefined) {
    const v =
      b.hire_date === null || (typeof b.hire_date === "string" && b.hire_date.trim() === "")
        ? null
        : parseDate(b.hire_date);
    if (v !== undefined) updates.start_date = v;
  }
  // Master fields
  if (b.date_of_birth !== undefined) {
    const v =
      b.date_of_birth === null ||
      (typeof b.date_of_birth === "string" && b.date_of_birth.trim() === "")
        ? null
        : parseDate(b.date_of_birth);
    if (v !== undefined) updates.date_of_birth = v;
    else if (b.date_of_birth !== null && b.date_of_birth !== undefined)
      details.push("date_of_birth must be YYYY-MM-DD or null");
  }
  if (b.site_id !== undefined) {
    if (b.site_id === null || b.site_id === "") updates.site_id = null;
    else if (typeof b.site_id === "string" && /^[0-9a-f-]{36}$/i.test(b.site_id.trim()))
      updates.site_id = b.site_id.trim();
    else details.push("site_id must be uuid or null");
  }
  if (b.org_unit_id !== undefined) {
    if (b.org_unit_id === null || b.org_unit_id === "") updates.org_unit_id = null;
    else if (typeof b.org_unit_id === "string" && /^[0-9a-f-]{36}$/i.test(b.org_unit_id.trim()))
      updates.org_unit_id = b.org_unit_id.trim();
    else details.push("org_unit_id must be uuid or null");
  }
  if (b.manager_id !== undefined) {
    if (b.manager_id === null || b.manager_id === "") updates.manager_id = null;
    else if (typeof b.manager_id === "string" && /^[0-9a-f-]{36}$/i.test(b.manager_id.trim()))
      updates.manager_id = b.manager_id.trim();
    else details.push("manager_id must be uuid or null");
  }
  if (b.team !== undefined) {
    updates.team = b.team === null ? null : typeof b.team === "string" ? b.team : undefined;
    if (updates.team === undefined && b.team !== null) details.push("team must be string or null");
  }
  if (b.role !== undefined) {
    updates.role = b.role === null ? null : typeof b.role === "string" ? b.role : undefined;
    if (updates.role === undefined && b.role !== null) details.push("role must be string or null");
  }

  if (details.length > 0) return { ok: false, code: "VALIDATION_ERROR", details };

  if (updates.employment_type === "permanent") {
    updates.contract_end_date = null;
  }
  if (updates.employment_type === "temporary" || updates.employment_type === "consultant") {
    const hasEnd =
      updates.contract_end_date != null && String(updates.contract_end_date).trim() !== "";
    if (!hasEnd) {
      details.push("contract_end_date is required for temporary or consultant employment");
      return { ok: false, code: "VALIDATION_ERROR", details };
    }
  }

  const startDate = updates.contract_start_date ?? null;
  const endDate = updates.contract_end_date ?? null;
  if (startDate != null && endDate != null && endDate < startDate) {
    details.push("contract_end_date must be >= contract_start_date when both set");
    return { ok: false, code: "VALIDATION_ERROR", details };
  }

  return { ok: true, updates };
}

function toEmployeeDto(row: Record<string, unknown>) {
  return {
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
    lineCode: (row.line_code ?? row.line) ?? "",
    team: row.team ?? "",
    employmentType: row.employment_type ?? "permanent",
    startDate: row.start_date ?? undefined,
    contractEndDate: row.contract_end_date ?? undefined,
    managerId: row.manager_id ?? undefined,
    positionId: row.position_id ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    postalCode: row.postal_code ?? undefined,
    country: row.country ?? "Sweden",
    isActive: row.is_active ?? true,
    orgId: row.org_id,
    siteId: row.site_id ?? undefined,
    orgUnitId: row.org_unit_id ?? undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  try {
    const { id: employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json(
        { ok: false, error: "Employee id required", requestId },
        { status: 400 }
      );
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const res = NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHENTICATED", requestId },
        { status: 401 }
      );
      applySupabaseCookies(res, pendingCookies);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: "Missing organization context", code: "ORG_CONTEXT_REQUIRED", requestId },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
    if (!org.activeOrgId?.trim()) {
      const res = NextResponse.json(
        { ok: false, error: "Missing organization context", code: "ORG_CONTEXT_REQUIRED", requestId },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
    if (org.activeSiteId == null || String(org.activeSiteId).trim() === "") {
      const res = NextResponse.json(
        { ok: false, error: "Missing site context", code: "SITE_CONTEXT_REQUIRED", requestId },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("org_id", org.activeOrgId)
      .eq("site_id", org.activeSiteId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[api/employees/[id]] GET error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load employee", requestId },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
    if (!data) {
      const res = NextResponse.json(
        { ok: false, error: "Employee not found", code: "NOT_FOUND", requestId },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const employee = toEmployeeDto(data as Record<string, unknown>);
    const res = NextResponse.json({ ok: true, employee }, { status: 200 });
    applySupabaseCookies(res, pendingCookies);
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]] GET", err);
    const requestId = randomUUID();
    return NextResponse.json(
      { ok: false, error: "Internal error", requestId },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const apply = (res: NextResponse) => {
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  };

  try {
    const { id } = await params;
    if (!id?.trim()) {
      return apply(
        NextResponse.json(
          { ok: false, error: { code: "VALIDATION_ERROR", details: ["Employee id required"] }, requestId },
          { status: 400 }
        )
      );
    }

    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      return apply(
        NextResponse.json({ ok: false, error: { code: "FORBIDDEN" }, requestId }, { status: 403 })
      );
    }
    const activeOrgId = auth.activeOrgId;

    const body = await request.json().catch(() => ({}));
    const validated = validatePatchBody(body);
    if (!validated.ok) {
      return apply(
        NextResponse.json(
          { ok: false, error: { code: validated.code, details: validated.details }, requestId },
          { status: 400 }
        )
      );
    }
    const updates = validated.updates;
    if (Object.keys(updates).length === 0) {
      return apply(
        NextResponse.json(
          { ok: false, error: { code: "VALIDATION_ERROR", details: ["No allowed fields to update"] }, requestId },
          { status: 400 }
        )
      );
    }

    if (updates.position_id !== undefined && updates.position_id) {
      const { data: pos } = await supabaseAdmin
        .from("positions")
        .select("id")
        .eq("id", updates.position_id)
        .eq("org_id", activeOrgId)
        .maybeSingle();
      if (!pos) {
        return apply(
          NextResponse.json(
            { ok: false, error: { code: "NOT_FOUND", details: ["Position not found"] }, requestId },
            { status: 404 }
          )
        );
      }
    }

    // Tenant safety: manager must exist in same org
    if (updates.manager_id !== undefined && updates.manager_id) {
      const { data: manager } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("id", updates.manager_id)
        .eq("org_id", activeOrgId)
        .maybeSingle();
      if (!manager) {
        return apply(
          NextResponse.json(
            { ok: false, error: { code: "NOT_FOUND", details: ["Manager not found in organization"] }, requestId },
            { status: 404 }
          )
        );
      }
    }
    if (updates.org_unit_id !== undefined && updates.org_unit_id) {
      const { data: unit } = await supabaseAdmin
        .from("org_units")
        .select("id")
        .eq("id", updates.org_unit_id)
        .eq("org_id", activeOrgId)
        .maybeSingle();
      if (!unit) {
        return apply(
          NextResponse.json(
            { ok: false, error: { code: "NOT_FOUND", details: ["Org unit not found in organization"] }, requestId },
            { status: 404 }
          )
        );
      }
    }
    if (updates.site_id !== undefined && updates.site_id) {
      const { data: site } = await supabaseAdmin
        .from("sites")
        .select("id")
        .eq("id", updates.site_id)
        .eq("org_id", activeOrgId)
        .maybeSingle();
      if (!site) {
        return apply(
          NextResponse.json(
            { ok: false, error: { code: "NOT_FOUND", details: ["Site not found in organization"] }, requestId },
            { status: 404 }
          )
        );
      }
    }

    const contractFieldsUpdated =
      updates.contract_start_date !== undefined ||
      updates.contract_end_date !== undefined ||
      updates.employment_type !== undefined;
    const masterFieldsUpdated =
      updates.date_of_birth !== undefined ||
      updates.site_id !== undefined ||
      updates.org_unit_id !== undefined ||
      updates.manager_id !== undefined ||
      updates.team !== undefined ||
      updates.role !== undefined;

    let beforeContract: Record<string, unknown> | null = null;
    let beforeMaster: Record<string, unknown> | null = null;

    const currentSelect =
      contractFieldsUpdated || masterFieldsUpdated
        ? [
            "contract_start_date",
            "contract_end_date",
            "employment_type",
            "employment_status",
            ...(masterFieldsUpdated
              ? ["date_of_birth", "site_id", "org_unit_id", "manager_id", "team", "role"]
              : []),
          ].join(", ")
        : null;

    if (currentSelect) {
      const { data: currentRow } = await supabaseAdmin
        .from("employees")
        .select(currentSelect)
        .eq("id", id)
        .eq("org_id", activeOrgId)
        .maybeSingle();
      if (currentRow) {
        const row = currentRow as unknown as Record<string, unknown>;
        if (contractFieldsUpdated) {
          beforeContract = {
            contract_start_date: row.contract_start_date ?? null,
            contract_end_date: row.contract_end_date ?? null,
            employment_type: row.employment_type ?? null,
            employment_status: row.employment_status ?? null,
          };
        }
        if (masterFieldsUpdated) {
          beforeMaster = {
            date_of_birth: row.date_of_birth ?? null,
            site_id: row.site_id ?? null,
            org_unit_id: row.org_unit_id ?? null,
            manager_id: row.manager_id ?? null,
            team: row.team ?? null,
            role: row.role ?? null,
          };
        }
      }
    }

    const dbPayload: Record<string, unknown> = {};
    if (updates.first_name !== undefined) dbPayload.first_name = updates.first_name;
    if (updates.last_name !== undefined) dbPayload.last_name = updates.last_name;
    if (updates.employee_number !== undefined) dbPayload.employee_number = updates.employee_number;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.role !== undefined) dbPayload.role = updates.role;
    else if (updates.title !== undefined) dbPayload.role = updates.title;
    if (updates.is_active !== undefined) dbPayload.is_active = updates.is_active;
    if (updates.position_id !== undefined) dbPayload.position_id = updates.position_id;
    if (updates.employment_type !== undefined) dbPayload.employment_type = updates.employment_type;
    if (updates.contract_start_date !== undefined) dbPayload.contract_start_date = updates.contract_start_date;
    if (updates.contract_end_date !== undefined) dbPayload.contract_end_date = updates.contract_end_date;
    if (updates.start_date !== undefined) dbPayload.start_date = updates.start_date;
    if (updates.date_of_birth !== undefined) dbPayload.date_of_birth = updates.date_of_birth;
    if (updates.site_id !== undefined) dbPayload.site_id = updates.site_id;
    if (updates.org_unit_id !== undefined) dbPayload.org_unit_id = updates.org_unit_id;
    if (updates.manager_id !== undefined) dbPayload.manager_id = updates.manager_id;
    if (updates.team !== undefined) dbPayload.team = updates.team;
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const first = updates.first_name ?? "";
      const last = updates.last_name ?? "";
      dbPayload.name = `${first} ${last}`.trim() || (dbPayload.name as string);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("employees")
      .update(dbPayload)
      .eq("id", id)
      .eq("org_id", activeOrgId);

    if (updateErr) {
      console.error("[api/employees/[id]] PATCH error", updateErr);
      return apply(
        NextResponse.json({ ok: false, error: "Failed to update employee", requestId }, { status: 500 })
      );
    }

    const { data: requery, error: fetchErr } = await supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, email, phone, date_of_birth, role, line, line_code, team, employment_type, start_date, contract_start_date, contract_end_date, employment_status, manager_id, position_id, address, city, postal_code, country, is_active, org_id, site_id, org_unit_id")
      .eq("id", id)
      .eq("org_id", activeOrgId)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("[api/employees/[id]] PATCH re-query", fetchErr);
      return apply(
        NextResponse.json({ ok: false, error: "Failed to load updated employee", requestId }, { status: 500 })
      );
    }
    if (!requery) {
      return apply(
        NextResponse.json({ ok: false, error: { code: "NOT_FOUND" }, requestId }, { status: 404 })
      );
    }

    if (beforeContract != null) {
      const requeryRow = requery as Record<string, unknown>;
      const afterContract = {
        contract_start_date: requeryRow.contract_start_date ?? null,
        contract_end_date: requeryRow.contract_end_date ?? null,
        employment_type: requeryRow.employment_type ?? null,
        employment_status: requeryRow.employment_status ?? null,
      };
      await auditWrite({
        admin: supabaseAdmin,
        orgId: activeOrgId,
        siteId: auth.activeSiteId ?? null,
        actorUserId: auth.userId,
        action: "EMPLOYEE_UPDATE",
        targetType: "EMPLOYEE",
        targetId: id,
        reasonCodes: ["CONTRACT"],
        before: beforeContract,
        after: afterContract,
        requestId,
        idempotencyKey: `EMPLOYEE_UPDATE:${id}:${requestId}:CONTRACT`,
      });
    }
    if (beforeMaster != null && requery) {
      const requeryRow = requery as Record<string, unknown>;
      const afterMaster = {
        date_of_birth: requeryRow.date_of_birth ?? null,
        site_id: requeryRow.site_id ?? null,
        org_unit_id: requeryRow.org_unit_id ?? null,
        manager_id: requeryRow.manager_id ?? null,
        team: requeryRow.team ?? null,
        role: requeryRow.role ?? null,
      };
      await auditWrite({
        admin: supabaseAdmin,
        orgId: activeOrgId,
        siteId: auth.activeSiteId ?? null,
        actorUserId: auth.userId,
        action: "EMPLOYEE_UPDATE",
        targetType: "EMPLOYEE",
        targetId: id,
        reasonCodes: ["MASTER"],
        before: beforeMaster,
        after: afterMaster,
        requestId,
        idempotencyKey: `EMPLOYEE_UPDATE:${id}:${requestId}:MASTER`,
      });
    }

    const employee = toEmployeeDto(requery as Record<string, unknown>);
    return apply(
      NextResponse.json({ ok: true, employee, requestId }, { status: 200 })
    );
  } catch (err) {
    console.error("[api/employees/[id]] PATCH", err);
    return apply(
      NextResponse.json({ ok: false, error: "Internal error", requestId }, { status: 500 })
    );
  }
}
