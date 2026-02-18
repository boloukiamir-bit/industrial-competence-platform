/**
 * POST /api/competence/actions — log competence action into execution_decisions (decision_type=competence_action).
 * Body: { employee_id: string, action_type: string, payload?: object }
 * Returns { ok: true, row } or { ok: false, error, step }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
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
  if (!membership) {
    const res = NextResponse.json(errorPayload("forbidden", "Not an org member"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { employee_id?: string; action_type?: string; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  const action_type = typeof body.action_type === "string" ? body.action_type.trim() : "";
  if (!employee_id || !action_type) {
    const res = NextResponse.json(
      errorPayload("validation", "employee_id and action_type are required"),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const payload = { employee_id, action_type, ...(body.payload ?? {}) };
  const root_cause = {
    type: "competence_action",
    employee_id,
    action_type,
    payload: body.payload ?? {},
  };
  const actions = { action_type, payload };

  const { error } = await supabaseAdmin
    .from("execution_decisions")
    .insert({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId ?? null,
      decision_type: "competence_action",
      target_type: "employee",
      target_id: employee_id,
      reason: action_type,
      root_cause,
      actions,
      status: "active",
      created_by: org.userId,
    });

  if (error) {
    console.error("POST /api/competence/actions insert error:", error);
    const res = NextResponse.json(errorPayload("insert", error.message), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
