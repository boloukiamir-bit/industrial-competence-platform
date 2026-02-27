/**
 * GET /api/hr/requirements-rules — list role→requirement rules for the org.
 * POST /api/hr/requirements-rules — create a rule. Audit: governance_events REQUIREMENT_RULE_CREATE.
 * Auth: requireAdminOrHr. Tenant: activeOrgId.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type RequirementRuleRow = {
  id: string;
  role: string;
  requirement_code: string;
  requirement_name: string;
  is_mandatory: boolean;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: rows, error } = await supabase
      .from("requirement_role_rules")
      .select("id, role, requirement_code, requirement_name, is_mandatory, created_at")
      .eq("org_id", auth.activeOrgId)
      .order("role", { ascending: true })
      .order("requirement_code", { ascending: true });

    if (error) {
      console.error("[hr/requirements-rules] list error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load rules" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rules: RequirementRuleRow[] = (rows ?? []).map(
      (r: {
        id: string;
        role: string;
        requirement_code: string;
        requirement_name: string;
        is_mandatory: boolean;
        created_at: string;
      }) => ({
        id: r.id,
        role: r.role,
        requirement_code: r.requirement_code,
        requirement_name: r.requirement_name,
        is_mandatory: r.is_mandatory,
        created_at: r.created_at,
      })
    );

    const res = NextResponse.json({ ok: true, rules });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements-rules] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    const res = NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  const requirement_code = typeof body.requirement_code === "string" ? body.requirement_code.trim() : "";
  const requirement_name = typeof body.requirement_name === "string" ? body.requirement_name.trim() : "";
  const is_mandatory = body.is_mandatory === false ? false : true;

  if (!role || !requirement_code || !requirement_name) {
    const res = NextResponse.json(
      { ok: false, error: "role, requirement_code, and requirement_name are required and non-empty" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: inserted, error } = await supabase
      .from("requirement_role_rules")
      .insert({
        org_id: auth.activeOrgId,
        role,
        requirement_code,
        requirement_name,
        is_mandatory,
      })
      .select("id, role, requirement_code, requirement_name, is_mandatory, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        const res = NextResponse.json(
          { ok: false, error: "A rule for this role and requirement already exists" },
          { status: 409 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[hr/requirements-rules] insert error", error);
      const res = NextResponse.json(
        { ok: false, error: error.message || "Failed to create rule" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rule: RequirementRuleRow = {
      id: inserted.id,
      role: inserted.role,
      requirement_code: inserted.requirement_code,
      requirement_name: inserted.requirement_name,
      is_mandatory: inserted.is_mandatory,
      created_at: inserted.created_at,
    };

    const idempotencyKey = `REQ_RULE_CREATE:${auth.activeOrgId}:${role}:${requirement_code}`;
    const { error: govError } = await supabaseAdmin.from("governance_events").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      actor_user_id: auth.userId,
      action: "REQUIREMENT_RULE_CREATE",
      target_type: "REQUIREMENT_RULE",
      target_id: inserted.id,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_REQUIREMENT_RULES_V1"],
      meta: { role, requirement_code, requirement_name, is_mandatory },
      idempotency_key: idempotencyKey,
    });

    if (govError) {
      if (govError.code === "23505") {
        // Duplicate idempotency_key = retry; treat as success
      } else {
        console.error("[hr/requirements-rules] governance_events insert failed", govError);
        const res = NextResponse.json(
          { ok: false, error: "Audit log failed; request not applied" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }

    const res = NextResponse.json({ ok: true, rule });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements-rules] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
