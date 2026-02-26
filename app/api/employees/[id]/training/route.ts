/**
 * GET /api/employees/[id]/training — return SAFETY training record (or empty).
 * PATCH /api/employees/[id]/training — upsert SAFETY record. Audit: EMPLOYEE_TRAINING_UPSERT, reason_codes TRAINING.
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

type TrainingBody = {
  training_code?: string;
  valid_to?: string | null;
  completed_on?: string | null;
};

function parseDate(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? str.slice(0, 10) : null;
}

function validateBody(body: unknown): { ok: true; payload: TrainingBody } | { ok: false; code: string; details: string[] } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "VALIDATION_ERROR", details: ["Body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const details: string[] = [];
  const training_code = typeof b.training_code === "string" && b.training_code.trim() ? b.training_code.trim() : "SAFETY";
  const valid_to = b.valid_to !== undefined ? parseDate(b.valid_to) : undefined;
  const completed_on = b.completed_on !== undefined ? parseDate(b.completed_on) : undefined;
  if (valid_to === undefined && b.valid_to !== undefined && b.valid_to !== null) {
    details.push("valid_to must be a valid date or null");
  }
  if (completed_on === undefined && b.completed_on !== undefined && b.completed_on !== null) {
    details.push("completed_on must be a valid date or null");
  }
  if (details.length > 0) return { ok: false, code: "VALIDATION_ERROR", details };
  return { ok: true, payload: { training_code, valid_to, completed_on } };
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
    .from("employee_trainings")
    .select("training_code, training_name, completed_on, valid_to")
    .eq("org_id", auth.activeOrgId)
    .eq("employee_id", id)
    .eq("training_code", "SAFETY")
    .maybeSingle();

  if (error) {
    console.error("[api/employees/[id]/training] GET error", error);
    const res = NextResponse.json({ ok: false, error: "Failed to load training" }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const r = row as { training_code?: string; training_name?: string | null; completed_on?: string | null; valid_to?: string | null } | null;
  const res = NextResponse.json({
    ok: true,
    training_code: r?.training_code ?? "SAFETY",
    training_name: r?.training_name ?? null,
    completed_on: r?.completed_on ?? null,
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
    .from("employee_trainings")
    .select("id, training_code, completed_on, valid_to")
    .eq("org_id", auth.activeOrgId)
    .eq("employee_id", id)
    .eq("training_code", payload.training_code!)
    .maybeSingle();

  const before = current
    ? {
        training_code: (current as Record<string, unknown>).training_code ?? null,
        completed_on: (current as Record<string, unknown>).completed_on ?? null,
        valid_to: (current as Record<string, unknown>).valid_to ?? null,
      }
    : null;

  const after = {
    training_code: payload.training_code ?? null,
    completed_on: payload.completed_on ?? null,
    valid_to: payload.valid_to ?? null,
  };

  const cur = current as { completed_on?: string | null; valid_to?: string | null } | null;
  const completed_on = payload.completed_on !== undefined ? payload.completed_on : (cur?.completed_on ?? null);
  const valid_to = payload.valid_to !== undefined ? payload.valid_to : (cur?.valid_to ?? null);

  const { error: upsertErr } = await supabaseAdmin
    .from("employee_trainings")
    .upsert(
      {
        org_id: auth.activeOrgId,
        site_id: siteId,
        employee_id: id,
        training_code: payload.training_code,
        completed_on,
        valid_to,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,employee_id,training_code" }
    );

  if (upsertErr) {
    console.error("[api/employees/[id]/training] upsert error", upsertErr);
    const res = NextResponse.json(
      { ok: false, error: { code: "UPDATE_FAILED", message: "Failed to save training" } },
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
    action: "EMPLOYEE_TRAINING_UPSERT",
    targetType: "EMPLOYEE",
    targetId: id,
    reasonCodes: ["TRAINING"],
    before: before ?? undefined,
    after,
    meta: { training_code: payload.training_code },
  });

  const res = NextResponse.json({
    ok: true,
    training_code: payload.training_code,
    completed_on: payload.completed_on ?? null,
    valid_to: payload.valid_to ?? null,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
