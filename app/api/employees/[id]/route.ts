/**
 * GET /api/employees/[id] — tenant-scoped by session (active_org_id).
 * PATCH /api/employees/[id] — update employee (e.g. is_active). Tenant-scoped.
 *
 * Curl examples (replace BASE_URL, TOKEN, EMPLOYEE_UUID):
 *   1) GET employee detail (tenant-scoped):
 *      curl -s -H "Authorization: Bearer TOKEN" -H "Cookie: sb-*-auth-token=..." "BASE_URL/api/employees/EMPLOYEE_UUID"
 *      Or with Bearer only (if API accepts it): curl -s -H "Authorization: Bearer TOKEN" "BASE_URL/api/employees/EMPLOYEE_UUID"
 *   2) PATCH deactivate:
 *      curl -s -X PATCH -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"is_active":false}' "BASE_URL/api/employees/EMPLOYEE_UUID"
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getRequestId } from "@/lib/server/requestId";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

const EMPLOYMENT_STATUS_VALUES = ["ACTIVE", "INACTIVE", "TERMINATED", "ARCHIVED"] as const;
type EmploymentStatus = (typeof EMPLOYMENT_STATUS_VALUES)[number];

type PatchEmployeeBody = {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  employment_external_id?: string | null;
  employee_number?: string | null;
  employment_form?: string | null;
  employment_status?: EmploymentStatus;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  is_active?: boolean;
  position_id?: string | null;
};

function parseDate(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? str : null;
}

function validatePatchBody(body: unknown): { ok: true; updates: PatchEmployeeBody } | { ok: false; code: string; details: string[] } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "VALIDATION_ERROR", details: ["Body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const details: string[] = [];
  const updates: PatchEmployeeBody = {};

  if (b.first_name !== undefined) {
    updates.first_name = typeof b.first_name === "string" ? b.first_name : undefined;
    if (updates.first_name === undefined && b.first_name !== null) details.push("first_name must be string");
  }
  if (b.last_name !== undefined) {
    updates.last_name = typeof b.last_name === "string" ? b.last_name : undefined;
    if (updates.last_name === undefined && b.last_name !== null) details.push("last_name must be string");
  }
  if (b.employment_external_id !== undefined) {
    updates.employment_external_id =
      b.employment_external_id === null || b.employment_external_id === ""
        ? null
        : typeof b.employment_external_id === "string"
          ? b.employment_external_id.trim() || null
          : undefined;
    if (updates.employment_external_id === undefined && b.employment_external_id !== null && b.employment_external_id !== "")
      details.push("employment_external_id must be string or null");
  }
  if (b.employee_number !== undefined) {
    updates.employee_number =
      b.employee_number === null || b.employee_number === ""
        ? null
        : typeof b.employee_number === "string"
          ? b.employee_number.trim() || null
          : undefined;
    if (updates.employee_number === undefined && b.employee_number !== null && b.employee_number !== "")
      details.push("employee_number must be string or null");
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
  if (b.employment_form !== undefined) {
    updates.employment_form =
      b.employment_form === null || b.employment_form === ""
        ? null
        : typeof b.employment_form === "string"
          ? b.employment_form.trim() || null
          : undefined;
    if (updates.employment_form === undefined && b.employment_form !== null && b.employment_form !== "")
      details.push("employment_form must be string or null");
  }
  if (b.contract_start_date !== undefined) {
    const v =
      b.contract_start_date === null || (typeof b.contract_start_date === "string" && b.contract_start_date.trim() === "")
        ? null
        : parseDate(b.contract_start_date);
    if (v !== undefined) updates.contract_start_date = v;
    else if (b.contract_start_date !== null && b.contract_start_date !== undefined)
      details.push("contract_start_date must be a valid date or null");
  }
  if (b.contract_end_date !== undefined) {
    const v =
      b.contract_end_date === null || (typeof b.contract_end_date === "string" && b.contract_end_date.trim() === "")
        ? null
        : parseDate(b.contract_end_date);
    if (v !== undefined) updates.contract_end_date = v;
    else if (b.contract_end_date !== null && b.contract_end_date !== undefined)
      details.push("contract_end_date must be a valid date or null");
  }
  if (b.hire_date !== undefined) {
    const v =
      b.hire_date === null || (typeof b.hire_date === "string" && b.hire_date.trim() === "")
        ? null
        : parseDate(b.hire_date);
    if (v !== undefined) updates.hire_date = v ?? undefined;
    else if (b.hire_date !== null && b.hire_date !== undefined && String(b.hire_date).trim() !== "")
      details.push("hire_date must be a valid date (YYYY-MM-DD) or null");
  }
  if (b.termination_date !== undefined) {
    const v =
      b.termination_date === null || (typeof b.termination_date === "string" && b.termination_date.trim() === "")
        ? null
        : parseDate(b.termination_date);
    if (v !== undefined) updates.termination_date = v;
    else if (b.termination_date !== null && b.termination_date !== undefined)
      details.push("termination_date must be a valid date or null");
  }
  if (b.employment_status !== undefined) {
    const v =
      typeof b.employment_status === "string" && EMPLOYMENT_STATUS_VALUES.includes(b.employment_status as EmploymentStatus)
        ? (b.employment_status as EmploymentStatus)
        : undefined;
    if (v !== undefined) updates.employment_status = v;
    else {
      if (b.employment_status === "ARCHIVED") {
        return { ok: false, code: "INVALID_TRANSITION", details: ["ARCHIVED cannot be set via API"] };
      }
      details.push("employment_status must be one of: ACTIVE, INACTIVE, TERMINATED");
    }
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
  if (b.is_active !== undefined) {
    if (typeof b.is_active === "boolean") updates.is_active = b.is_active;
    else details.push("is_active must be boolean");
  }

  if (details.length > 0) return { ok: false, code: "VALIDATION_ERROR", details };
  return { ok: true, updates };
}

function validateLifecycleRules(
  updates: PatchEmployeeBody,
  current: { employment_status?: string | null; termination_date?: string | null }
): { ok: true } | { ok: false; code: string; details: string[] } {
  const status = updates.employment_status;
  const termDate = updates.termination_date;
  const curTerm = current.termination_date;
  if (status === "ARCHIVED") {
    return { ok: false, code: "INVALID_TRANSITION", details: ["ARCHIVED cannot be set via API"] };
  }
  if (status === "TERMINATED") {
    const effectiveTerm = termDate ?? curTerm;
    if (effectiveTerm === null || effectiveTerm === undefined || String(effectiveTerm).trim() === "") {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        details: ["termination_date is required when employment_status is TERMINATED"],
      };
    }
    const d = new Date(effectiveTerm);
    if (!Number.isFinite(d.getTime())) {
      return { ok: false, code: "VALIDATION_ERROR", details: ["termination_date must be a valid date"] };
    }
  }
  if (status === "ACTIVE" || status === "INACTIVE") {
    const effectiveTerm = termDate !== undefined ? termDate : curTerm;
    if (effectiveTerm != null && String(effectiveTerm).trim() !== "") {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        details: ["termination_date must be null when employment_status is ACTIVE or INACTIVE"],
      };
    }
  }
  return { ok: true };
}

function validateContractDates(
  updates: PatchEmployeeBody,
  existing: { contract_start_date?: string | null; contract_end_date?: string | null } | null | undefined
): { ok: true } | { ok: false; code: string; details: string[] } {
  if (existing == null || typeof existing !== "object") {
    return { ok: true };
  }
  const start =
    updates.contract_start_date !== undefined
      ? updates.contract_start_date
      : (existing.contract_start_date ?? null);
  const end =
    updates.contract_end_date !== undefined
      ? updates.contract_end_date
      : (existing.contract_end_date ?? null);
  const startStr = start != null ? String(start).trim() : "";
  const endStr = end != null ? String(end).trim() : "";
  if (startStr !== "" && endStr !== "") {
    const startDate = new Date(start!);
    const endDate = new Date(end!);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        details: ["contract_start_date and contract_end_date must be valid dates when both set"],
      };
    }
    if (endDate < startDate) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        details: ["contract_end_date must be >= contract_start_date when both set"],
      };
    }
  }
  return { ok: true };
}

function toEmployeeDto(row: Record<string, unknown> & { manager?: { name: string } | null }) {
  return {
    id: row.id,
    name: row.name ?? "",
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    employeeNumber: (row.employee_number as string | null) ?? "",
    employmentExternalId: (row.employment_external_id as string | null) ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    role: row.role ?? "",
    line: row.line ?? "",
    lineCode: (row.line_code ?? row.line) ?? "",
    team: row.team ?? "",
    employmentType: row.employment_type ?? "permanent",
    employmentForm: (row.employment_form as string | null) ?? undefined,
    startDate: row.start_date ?? undefined,
    contractStartDate: (row.contract_start_date as string | null) ?? undefined,
    contractEndDate: (row.contract_end_date as string | null) ?? undefined,
    managerId: row.manager_id ?? undefined,
    managerName: (row.manager as { name?: string } | null)?.name ?? undefined,
    positionId: row.position_id ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    postalCode: row.postal_code ?? undefined,
    country: row.country ?? "Sweden",
    isActive: row.is_active ?? true,
    orgId: row.org_id,
    employmentStatus: row.employment_status ?? "ACTIVE",
    hireDate: (row.hire_date as string | null) ?? undefined,
    terminationDate: (row.termination_date as string | null) ?? undefined,
    statusChangedAt: row.status_changed_at ?? undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json({ ok: false, error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const res = NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: "Missing organization context", code: "ORG_CONTEXT_REQUIRED" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!org.activeOrgId?.trim()) {
      const res = NextResponse.json(
        { ok: false, error: "Missing organization context", code: "ORG_CONTEXT_REQUIRED" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (org.activeSiteId == null || String(org.activeSiteId).trim() === "") {
      const res = NextResponse.json(
        { ok: false, error: "Missing site context", code: "SITE_CONTEXT_REQUIRED" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("org_id", org.activeOrgId)
      .eq("site_id", org.activeSiteId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[api/employees/[id]] GET error", error);
      const res = NextResponse.json({ ok: false, error: "Failed to load employee" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json(
        { ok: false, error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employee = toEmployeeDto(data as Record<string, unknown> & { manager?: { name: string } | null });
    const res = NextResponse.json({ ok: true, employee }, { status: 200 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]] GET", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>["supabase"];
  let pendingCookies: Awaited<ReturnType<typeof createSupabaseServerClient>>["pendingCookies"];
  try {
    const created = await createSupabaseServerClient(request);
    supabase = created.supabase;
    pendingCookies = created.pendingCookies;
  } catch (setupErr) {
    const errObj = setupErr as { message?: string; code?: string };
    console.error(`[${requestId}] PATCH setup failed:`, errObj?.message ?? setupErr);
    const res = NextResponse.json(
      {
        ok: false,
        error: "Internal error",
        requestId,
        ...(process.env.NODE_ENV !== "production" && errObj?.message != null ? { details: { message: errObj.message, code: errObj.code } } : {}),
      },
      { status: 500 }
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
  const apply = (res: NextResponse) => {
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  };

  try {
    const { id } = await params;
    const employeeId = id?.trim() ?? "";
    if (!employeeId) {
      return apply(
        NextResponse.json({ ok: false, error: "Employee id required", code: "VALIDATION_ERROR" }, { status: 400 })
      );
    }

    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      return apply(
        NextResponse.json({ ok: false, error: auth.error ?? "Forbidden", code: "FORBIDDEN" }, { status: auth.status ?? 403 })
      );
    }
    const activeOrgId = auth.activeOrgId;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[${requestId}] PATCH auth ok, activeOrgId=${activeOrgId}, employeeId=${employeeId}`);
    }

    const body = await request.json().catch(() => ({}));
    const validated = validatePatchBody(body);
    if (!validated.ok) {
      const msg = validated.details?.length ? validated.details.join("; ") : validated.code;
      return apply(
        NextResponse.json(
          { ok: false, error: msg, code: validated.code, details: validated.details },
          { status: 400 }
        )
      );
    }
    const updates = validated.updates;
    if (Object.keys(updates).length === 0) {
      return apply(
        NextResponse.json(
          { ok: false, error: "No allowed fields to update", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[${requestId}] PATCH payload`, JSON.stringify(updates));
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("employees")
      .select("id, first_name, last_name, employment_status, termination_date, contract_start_date, contract_end_date, site_id")
      .eq("id", employeeId)
      .eq("org_id", activeOrgId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[${requestId}] PATCH fetch current`, fetchErr);
      return apply(
        NextResponse.json({ ok: false, error: "Failed to load employee", requestId }, { status: 500 })
      );
    }
    if (!existing) {
      return apply(
        NextResponse.json({ ok: false, error: "Employee not found", code: "NOT_FOUND" }, { status: 404 })
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[${requestId}] PATCH after fetch existing employee`);
    }

    const existingRow = existing as {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      employment_status?: string | null;
      termination_date?: string | null;
      contract_start_date?: string | null;
      contract_end_date?: string | null;
      site_id?: string | null;
    };

    const lifecycleCheck = validateLifecycleRules(updates, {
      employment_status: existingRow.employment_status,
      termination_date: existingRow.termination_date,
    });
    if (!lifecycleCheck.ok) {
      const msg = lifecycleCheck.details?.length ? lifecycleCheck.details.join("; ") : lifecycleCheck.code;
      return apply(
        NextResponse.json(
          { ok: false, error: msg, code: lifecycleCheck.code, details: lifecycleCheck.details },
          { status: 400 }
        )
      );
    }

    const contractCheck = validateContractDates(updates, {
      contract_start_date: existingRow.contract_start_date,
      contract_end_date: existingRow.contract_end_date,
    });
    if (!contractCheck.ok) {
      const msg = contractCheck.details?.length ? contractCheck.details.join("; ") : contractCheck.code;
      return apply(
        NextResponse.json(
          { ok: false, error: msg, code: contractCheck.code, details: contractCheck.details },
          { status: 400 }
        )
      );
    }

    if (updates.position_id !== undefined) {
      const positionId = updates.position_id;
      if (positionId) {
        const { data: pos } = await supabaseAdmin
          .from("positions")
          .select("id")
          .eq("id", positionId)
          .eq("org_id", activeOrgId)
          .maybeSingle();
        if (!pos) {
          return apply(
            NextResponse.json({ ok: false, error: "Position not found", code: "NOT_FOUND" }, { status: 404 })
          );
        }
      }
    }

    const dbPayload: Record<string, unknown> = {};
    if (updates.first_name !== undefined) dbPayload.first_name = updates.first_name;
    if (updates.last_name !== undefined) dbPayload.last_name = updates.last_name;
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const firstName = updates.first_name ?? existingRow.first_name ?? "";
      const lastName = updates.last_name ?? existingRow.last_name ?? "";
      dbPayload.name = `${firstName} ${lastName}`.trim() || "Unnamed";
    }
    if (updates.employment_external_id !== undefined) dbPayload.employment_external_id = updates.employment_external_id;
    if (updates.employee_number !== undefined) dbPayload.employee_number = updates.employee_number;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    // employees table has no 'title' column; omit from update to avoid PGRST204
    if (updates.employment_form !== undefined) dbPayload.employment_form = updates.employment_form;
    if (updates.contract_start_date !== undefined) dbPayload.contract_start_date = updates.contract_start_date;
    if (updates.contract_end_date !== undefined) dbPayload.contract_end_date = updates.contract_end_date;
    if (updates.hire_date !== undefined) dbPayload.hire_date = updates.hire_date;
    if (updates.termination_date !== undefined) dbPayload.termination_date = updates.termination_date;
    if (updates.employment_status !== undefined) dbPayload.employment_status = updates.employment_status;
    if (updates.position_id !== undefined) dbPayload.position_id = updates.position_id;
    if (updates.is_active !== undefined) dbPayload.is_active = updates.is_active;

    const currentStatus = existingRow.employment_status ?? "ACTIVE";
    if (
      updates.employment_status !== undefined &&
      updates.employment_status !== currentStatus
    ) {
      dbPayload.status_changed_by = auth.userId;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[${requestId}] PATCH before update`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("employees")
      .update(dbPayload)
      .eq("id", employeeId)
      .eq("org_id", activeOrgId);

    if (updateErr) {
      const pgErr = updateErr as { code?: string; message?: string; details?: string };
      console.error(`[${requestId}] PATCH update error`, pgErr?.code, pgErr?.message, pgErr?.details);
      const payload: { ok: false; error: string; requestId: string; code?: string; details?: Record<string, unknown> } = {
        ok: false,
        error: "Failed to update employee",
        requestId,
      };
      if (process.env.NODE_ENV !== "production") {
        payload.code = pgErr?.code;
        payload.details = {
          message: pgErr?.message ?? String(updateErr),
          ...(pgErr?.details != null ? { details: pgErr.details } : {}),
        };
      }
      return apply(NextResponse.json(payload, { status: 500 }));
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[${requestId}] PATCH after update`);
    }

    const { data: row, error: reloadErr } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("org_id", activeOrgId)
      .single();

    if (reloadErr || !row) {
      const pgErr = reloadErr as { code?: string; message?: string } | undefined;
      console.error(`[${requestId}] PATCH fetch after update`, pgErr?.code ?? "no row", pgErr?.message ?? (row ? "" : "no row"));
      const payload: { ok: false; error: string; requestId: string; code?: string; details?: Record<string, unknown> } = {
        ok: false,
        error: "Failed to load updated employee",
        requestId,
      };
      if (process.env.NODE_ENV !== "production") {
        payload.code = pgErr?.code ?? (row ? undefined : "NO_ROW");
        payload.details = { message: pgErr?.message ?? (row ? "" : "no row returned after update") };
      }
      return apply(NextResponse.json(payload, { status: 500 }));
    }

    const changedMeta: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      const v = (updates as Record<string, unknown>)[key];
      if (v !== undefined) changedMeta[key] = v;
    }
    const idempotencyKey = `EMP_UPDATE:${employeeId}:${Date.now()}`;
    try {
      const { error: govErr } = await supabaseAdmin.from("governance_events").insert({
        org_id: activeOrgId,
        site_id: existingRow.site_id ?? auth.activeSiteId ?? null,
        actor_user_id: auth.userId,
        action: "EMPLOYEE_UPDATE",
        target_type: "EMPLOYEE",
        target_id: employeeId,
        outcome: "RECORDED",
        legitimacy_status: "OK",
        readiness_status: "NON_BLOCKING",
        reason_codes: ["EMPLOYEE_LIFECYCLE"],
        meta: changedMeta,
        idempotency_key: idempotencyKey,
      });
      if (govErr) {
        console.error(`[${requestId}] PATCH governance_events insert (non-fatal)`, govErr);
      } else if (process.env.NODE_ENV !== "production") {
        console.log(`[${requestId}] PATCH after governance insert`);
      }
    } catch (govThrow) {
      console.error(`[${requestId}] PATCH governance_events insert threw (non-fatal)`, govThrow);
    }

    let employee: ReturnType<typeof toEmployeeDto>;
    try {
      const plainRow = typeof row === "object" && row !== null ? { ...row } : (row as Record<string, unknown>);
      employee = toEmployeeDto(plainRow as Record<string, unknown>);
    } catch (dtoErr) {
      const errObj = dtoErr as { message?: string };
      console.error(`[${requestId}] PATCH toEmployeeDto failed`, errObj?.message ?? dtoErr);
      return apply(
        NextResponse.json(
          {
            ok: false,
            error: "Failed to build response",
            requestId,
            ...(process.env.NODE_ENV !== "production" && { details: { message: String(errObj?.message ?? dtoErr) } }),
          },
          { status: 500 }
        )
      );
    }
    return apply(
      NextResponse.json({ ok: true, employee }, { status: 200 })
    );
  } catch (err) {
    const errObj = err as { message?: string; code?: string; stack?: string };
    console.error(`[${requestId}] PATCH failed:`, errObj?.message ?? err, errObj?.stack);
    const payload: { ok: false; error: string; requestId: string; details?: Record<string, unknown> } = {
      ok: false,
      error: "Internal error",
      requestId,
    };
    if (process.env.NODE_ENV !== "production") {
      payload.details = {
        ...(errObj?.message != null ? { message: errObj.message } : {}),
        ...(errObj?.code != null ? { code: errObj.code } : {}),
      };
    }
    return apply(NextResponse.json(payload, { status: 500 }));
  }
}
