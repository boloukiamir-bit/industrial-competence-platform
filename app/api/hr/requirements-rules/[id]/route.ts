/**
 * PATCH /api/hr/requirements-rules/[id] — update is_mandatory. Audit: governance_events REQUIREMENT_RULE_UPDATE.
 * DELETE /api/hr/requirements-rules/[id] — delete rule. Audit: governance_events REQUIREMENT_RULE_DELETE.
 * Auth: requireAdminOrHr. Tenant: activeOrgId (row must belong to org).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const { id } = await params;
  if (!id) {
    const res = NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
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

  const is_mandatory = body.is_mandatory === true || body.is_mandatory === false ? body.is_mandatory : undefined;
  if (is_mandatory === undefined) {
    const res = NextResponse.json(
      { ok: false, error: "is_mandatory (boolean) is required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("requirement_role_rules")
      .select("role, requirement_code, requirement_name, is_mandatory")
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .maybeSingle();

    if (fetchError || !existing) {
      const res = NextResponse.json(
        { ok: false, error: "Rule not found" },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabase
      .from("requirement_role_rules")
      .update({ is_mandatory })
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[hr/requirements-rules] update error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to update rule" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!data) {
      const res = NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const idempotencyKey = `REQ_RULE_UPDATE:${auth.activeOrgId}:${id}:${is_mandatory}`;
    const before = {
      role: existing.role,
      requirement_code: existing.requirement_code,
      requirement_name: existing.requirement_name,
      is_mandatory: existing.is_mandatory,
    };
    const after = { ...before, is_mandatory };

    const { error: govError } = await supabaseAdmin.from("governance_events").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      actor_user_id: auth.userId,
      action: "REQUIREMENT_RULE_UPDATE",
      target_type: "REQUIREMENT_RULE",
      target_id: id,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_REQUIREMENT_RULES_V1"],
      meta: { before, after },
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

    const res = NextResponse.json({ ok: true });
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(_request);
  const auth = await requireAdminOrHr(_request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    const res = NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("requirement_role_rules")
      .select("id, role, requirement_code, requirement_name, is_mandatory")
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .maybeSingle();

    if (fetchError || !existing) {
      const res = NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabase
      .from("requirement_role_rules")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[hr/requirements-rules] delete error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to delete rule" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!data) {
      const res = NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const idempotencyKey = `REQ_RULE_DELETE:${auth.activeOrgId}:${id}`;
    const deleted = {
      role: existing.role,
      requirement_code: existing.requirement_code,
      requirement_name: existing.requirement_name,
      is_mandatory: existing.is_mandatory,
    };

    const { error: govError } = await supabaseAdmin.from("governance_events").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      actor_user_id: auth.userId,
      action: "REQUIREMENT_RULE_DELETE",
      target_type: "REQUIREMENT_RULE",
      target_id: id,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_REQUIREMENT_RULES_V1"],
      meta: { deleted },
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

    const res = NextResponse.json({ ok: true });
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
