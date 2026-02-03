/**
 * POST /api/compliance/actions/create — create one compliance action. Admin/HR only.
 * Body: { employee_id, compliance_code, action_type, due_date?, notes? }
 * Resolves compliance_id by (org_id, compliance_code). Tenant: getActiveOrgFromSession + activeSiteId.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACTION_TYPES = ["request_renewal", "request_evidence", "notify_employee", "mark_waived_review"] as const;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  const compliance_code = typeof body.compliance_code === "string" ? body.compliance_code.trim() : "";
  const action_type = typeof body.action_type === "string" ? body.action_type.trim() : "";
  if (!employee_id || !compliance_code || !action_type) {
    const res = NextResponse.json(
      errorPayload("validation", "employee_id, compliance_code, and action_type are required"),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!ACTION_TYPES.includes(action_type as (typeof ACTION_TYPES)[number])) {
    const res = NextResponse.json(
      errorPayload("validation", `action_type must be one of: ${ACTION_TYPES.join(", ")}`),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const due_date = typeof body.due_date === "string" ? body.due_date.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  try {
    const { data: catalogRow, error: catError } = await supabaseAdmin
      .from("compliance_catalog")
      .select("id")
      .eq("org_id", org.activeOrgId)
      .eq("code", compliance_code)
      .eq("is_active", true)
      .maybeSingle();

    if (catError || !catalogRow) {
      const res = NextResponse.json(
        errorPayload("catalog", "Compliance code not found or inactive", catError?.message),
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: empRow, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, site_id")
      .eq("id", employee_id)
      .eq("org_id", org.activeOrgId)
      .eq("is_active", true)
      .maybeSingle();

    if (empError || !empRow) {
      const res = NextResponse.json(
        errorPayload("employee", "Employee not found or not in org", empError?.message),
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const actionSiteId =
      org.activeSiteId != null
        ? org.activeSiteId
        : (empRow.site_id ?? null);
    if (
      org.activeSiteId != null &&
      empRow.site_id != null &&
      org.activeSiteId !== empRow.site_id
    ) {
      const res = NextResponse.json(
        {
          ok: false,
          step: "site_mismatch",
          message: "Employee does not belong to active site",
        },
        { status: 409 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const site_id = actionSiteId;

    const insertRow = {
      org_id: org.activeOrgId,
      site_id,
      employee_id,
      compliance_id: catalogRow.id,
      action_type,
      status: "open",
      owner_user_id: org.userId,
      due_date: due_date || null,
      notes,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("compliance_actions")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error("compliance/actions/create insert", error);
      const res = NextResponse.json(errorPayload("insert", error.message, error.details ?? undefined), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, action_id: inserted?.id });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/actions/create failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
