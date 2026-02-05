/**
 * POST /api/compliance/employee/upsert — set/update one employee compliance. Admin/HR only.
 * Body: { employee_id, compliance_code, valid_from?, valid_to?, evidence_url?, notes?, waived? }
 * Resolves compliance_id by code (org-scoped). Returns { ok: true, item } or { ok: false, step, error, details }.
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
    const res = NextResponse.json(
      { ok: false as const, step: "forbidden", error: "Admin or HR role required" },
      { status: 403 }
    );
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
  if (!employee_id || !compliance_code) {
    const res = NextResponse.json(errorPayload("validation", "employee_id and compliance_code are required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const valid_from = typeof body.valid_from === "string" ? body.valid_from || null : null;
  const valid_to = typeof body.valid_to === "string" ? body.valid_to || null : null;
  const evidence_url = typeof body.evidence_url === "string" ? body.evidence_url.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const waived = body.waived === true;

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

    const compliance_id = catalogRow.id;

    const { data: empRow, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, site_id")
      .eq("id", employee_id)
      .eq("org_id", org.activeOrgId)
      .maybeSingle();

    if (empError) {
      console.error("compliance/employee/upsert employee lookup", empError);
      const res = NextResponse.json(
        errorPayload("employee", empError.message, empError.details ?? undefined),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!empRow) {
      const res = NextResponse.json(errorPayload("employee", "Employee not found or not in org"), { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const site_id = empRow.site_id ?? null;

    const row = {
      org_id: org.activeOrgId,
      site_id,
      employee_id,
      compliance_id,
      valid_from: valid_from || null,
      valid_to: valid_to || null,
      evidence_url,
      notes,
      waived,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("employee_compliance")
      .upsert(row, { onConflict: "org_id,employee_id,compliance_id", ignoreDuplicates: false })
      .select("id, org_id, site_id, employee_id, compliance_id, valid_from, valid_to, evidence_url, notes, waived, created_at, updated_at")
      .single();

    if (error) {
      console.error("compliance/employee/upsert", { step: "upsert", error });
      const res = NextResponse.json(errorPayload("upsert", error.message, error.details ?? undefined), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const item = data
      ? {
          id: data.id,
          org_id: data.org_id,
          site_id: data.site_id ?? null,
          employee_id: data.employee_id,
          compliance_id: data.compliance_id,
          valid_from: data.valid_from ?? null,
          valid_to: data.valid_to ?? null,
          evidence_url: data.evidence_url ?? null,
          notes: data.notes ?? null,
          waived: data.waived,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }
      : null;

    const res = NextResponse.json({ ok: true, item });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/employee/upsert failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
