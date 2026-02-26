/**
 * PATCH /api/employees/[id]/medical — upsert employee medical (GENERAL) validity.
 * Auth: requireAdminOrHr. Tenant: org_id from session. Governance audit on success.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { auditWrite } from "@/lib/server/governance/auditWrite";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MedicalBody = {
  medical_type?: string;
  valid_from?: string | null;
  valid_to?: string | null;
};

function parseDate(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? str.slice(0, 10) : null;
}

function validateBody(body: unknown): { ok: true; payload: MedicalBody } | { ok: false; code: string; details: string[] } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "VALIDATION_ERROR", details: ["Body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const details: string[] = [];
  const medical_type = typeof b.medical_type === "string" && b.medical_type.trim() ? b.medical_type.trim() : "GENERAL";
  const valid_from = b.valid_from !== undefined ? parseDate(b.valid_from) : undefined;
  const valid_to = b.valid_to !== undefined ? parseDate(b.valid_to) : undefined;
  if (valid_from === undefined && b.valid_from !== undefined && b.valid_from !== null) {
    details.push("valid_from must be a valid date or null");
  }
  if (valid_to === undefined && b.valid_to !== undefined && b.valid_to !== null) {
    details.push("valid_to must be a valid date or null");
  }
  if (details.length > 0) return { ok: false, code: "VALIDATION_ERROR", details };
  return { ok: true, payload: { medical_type, valid_from, valid_to } };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const id = (await params).id;
  if (!id) {
    const res = NextResponse.json({ ok: false, error: "Missing employee id" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: row, error } = await supabaseAdmin
    .from("employee_medicals")
    .select("medical_type, valid_from, valid_to")
    .eq("org_id", auth.activeOrgId)
    .eq("employee_id", id)
    .eq("medical_type", "GENERAL")
    .maybeSingle();

  if (error) {
    console.error("[api/employees/[id]/medical] GET error", error);
    const res = NextResponse.json({ ok: false, error: "Failed to load medical" }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const r = row as { medical_type?: string; valid_from?: string | null; valid_to?: string | null } | null;
  const res = NextResponse.json({
    ok: true,
    medical_type: r?.medical_type ?? "GENERAL",
    valid_from: r?.valid_from ?? null,
    valid_to: r?.valid_to ?? null,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const id = (await params).id;
  if (!id) {
    const res = NextResponse.json({ ok: false, error: "Missing employee id" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const validated = validateBody(body);
  if (!validated.ok) {
    const res = NextResponse.json(
      { ok: false, error: { code: validated.code, details: validated.details } },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { payload } = validated;

  // Ensure employee belongs to org (and get site_id for audit/upsert)
  const { data: emp, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("id, org_id, site_id")
    .eq("id", id)
    .eq("org_id", auth.activeOrgId)
    .maybeSingle();

  if (empErr || !emp) {
    const res = NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Employee not found" } },
      { status: 404 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const siteId = (emp as { site_id?: string | null }).site_id ?? auth.activeSiteId ?? null;

  // Current row for before/after
  const { data: current } = await supabaseAdmin
    .from("employee_medicals")
    .select("id, medical_type, valid_from, valid_to")
    .eq("org_id", auth.activeOrgId)
    .eq("employee_id", id)
    .eq("medical_type", payload.medical_type!)
    .maybeSingle();

  const before = current
    ? {
        medical_type: (current as Record<string, unknown>).medical_type ?? null,
        valid_from: (current as Record<string, unknown>).valid_from ?? null,
        valid_to: (current as Record<string, unknown>).valid_to ?? null,
      }
    : null;

  const after = {
    medical_type: payload.medical_type ?? null,
    valid_from: payload.valid_from ?? null,
    valid_to: payload.valid_to ?? null,
  };

  const cur = current as { valid_from?: string | null; valid_to?: string | null } | null;
  const valid_from = payload.valid_from !== undefined ? payload.valid_from : (cur?.valid_from ?? null);
  const valid_to = payload.valid_to !== undefined ? payload.valid_to : (cur?.valid_to ?? null);

  const { error: upsertErr } = await supabaseAdmin
    .from("employee_medicals")
    .upsert(
      {
        org_id: auth.activeOrgId,
        site_id: siteId,
        employee_id: id,
        medical_type: payload.medical_type,
        valid_from,
        valid_to,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,employee_id,medical_type" }
    );

  if (upsertErr) {
    console.error("[api/employees/[id]/medical] upsert error", upsertErr);
    const res = NextResponse.json(
      { ok: false, error: { code: "UPDATE_FAILED", message: "Failed to save medical" } },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  await auditWrite({
    admin: supabaseAdmin,
    orgId: auth.activeOrgId,
    siteId,
    actorUserId: auth.userId,
    action: "EMPLOYEE_MEDICAL_UPSERT",
    targetType: "EMPLOYEE",
    targetId: id,
    reasonCodes: ["MEDICAL"],
    before: before ?? undefined,
    after,
    meta: { medical_type: payload.medical_type },
  });

  const res = NextResponse.json({
    ok: true,
    medical_type: payload.medical_type,
    valid_from: payload.valid_from ?? null,
    valid_to: payload.valid_to ?? null,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
