/**
 * GET /api/employees/[id]/certificate — return FORKLIFT certificate record (or empty).
 * PATCH /api/employees/[id]/certificate — upsert FORKLIFT row. Audit: EMPLOYEE_CERTIFICATE_UPSERT, reason_codes CERTIFICATE.
 * Auth: requireAdminOrHr. Tenant: org_id from session. Employee must belong to org.
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

type CertificateBody = {
  certificate_code?: string;
  valid_to?: string | null;
  issued_on?: string | null;
};

function parseDate(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? str.slice(0, 10) : null;
}

function validateBody(body: unknown): { ok: true; payload: CertificateBody } | { ok: false; code: string; details: string[] } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "VALIDATION_ERROR", details: ["Body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const details: string[] = [];
  const certificate_code = typeof b.certificate_code === "string" && b.certificate_code.trim() ? b.certificate_code.trim() : "FORKLIFT";
  const valid_to = b.valid_to !== undefined ? parseDate(b.valid_to) : undefined;
  const issued_on = b.issued_on !== undefined ? parseDate(b.issued_on) : undefined;
  if (valid_to === undefined && b.valid_to !== undefined && b.valid_to !== null) {
    details.push("valid_to must be a valid date or null");
  }
  if (issued_on === undefined && b.issued_on !== undefined && b.issued_on !== null) {
    details.push("issued_on must be a valid date or null");
  }
  if (details.length > 0) return { ok: false, code: "VALIDATION_ERROR", details };
  return { ok: true, payload: { certificate_code, valid_to, issued_on } };
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
    .from("employee_certificates")
    .select("certificate_code, certificate_name, issued_on, valid_to")
    .eq("org_id", auth.activeOrgId)
    .eq("employee_id", id)
    .eq("certificate_code", "FORKLIFT")
    .maybeSingle();

  if (error) {
    console.error("[api/employees/[id]/certificate] GET error", error);
    const res = NextResponse.json({ ok: false, error: "Failed to load certificate" }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const r = row as { certificate_code?: string; certificate_name?: string | null; issued_on?: string | null; valid_to?: string | null } | null;
  const res = NextResponse.json({
    ok: true,
    certificate_code: r?.certificate_code ?? "FORKLIFT",
    certificate_name: r?.certificate_name ?? null,
    issued_on: r?.issued_on ?? null,
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

  const { data: current } = await supabaseAdmin
    .from("employee_certificates")
    .select("id, certificate_code, issued_on, valid_to")
    .eq("org_id", auth.activeOrgId)
    .eq("employee_id", id)
    .eq("certificate_code", payload.certificate_code!)
    .maybeSingle();

  const before = current
    ? {
        certificate_code: (current as Record<string, unknown>).certificate_code ?? null,
        issued_on: (current as Record<string, unknown>).issued_on ?? null,
        valid_to: (current as Record<string, unknown>).valid_to ?? null,
      }
    : null;

  const after = {
    certificate_code: payload.certificate_code ?? null,
    issued_on: payload.issued_on ?? null,
    valid_to: payload.valid_to ?? null,
  };

  const cur = current as { issued_on?: string | null; valid_to?: string | null } | null;
  const issued_on = payload.issued_on !== undefined ? payload.issued_on : (cur?.issued_on ?? null);
  const valid_to = payload.valid_to !== undefined ? payload.valid_to : (cur?.valid_to ?? null);

  const { error: upsertErr } = await supabaseAdmin
    .from("employee_certificates")
    .upsert(
      {
        org_id: auth.activeOrgId,
        site_id: siteId,
        employee_id: id,
        certificate_code: payload.certificate_code,
        issued_on,
        valid_to,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,employee_id,certificate_code" }
    );

  if (upsertErr) {
    console.error("[api/employees/[id]/certificate] upsert error", upsertErr);
    const res = NextResponse.json(
      { ok: false, error: { code: "UPDATE_FAILED", message: "Failed to save certificate" } },
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
    action: "EMPLOYEE_CERTIFICATE_UPSERT",
    targetType: "EMPLOYEE",
    targetId: id,
    reasonCodes: ["CERTIFICATE"],
    before: before ?? undefined,
    after,
    meta: { certificate_code: payload.certificate_code },
  });

  const res = NextResponse.json({
    ok: true,
    certificate_code: payload.certificate_code,
    issued_on: payload.issued_on ?? null,
    valid_to: payload.valid_to ?? null,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
