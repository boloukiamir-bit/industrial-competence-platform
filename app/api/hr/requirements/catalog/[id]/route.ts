/**
 * DELETE /api/hr/requirements/catalog/[id]
 * Deactivate a compliance_requirements catalog item (soft delete). Auth: requireAdminOrHr. Tenant: activeOrgId.
 * No physical delete. Writes governance_events REQUIREMENT_CATALOG_DEACTIVATE.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // Guardrail: block deactivation if any bindings reference this requirement
    const { data: bindings, error: bindError } = await supabase
      .from("employee_requirement_bindings")
      .select("id")
      .eq("requirement_id", id)
      .eq("org_id", auth.activeOrgId)
      .limit(1);

    if (bindError) {
      console.error("[hr/requirements/catalog] bindings check error", bindError);
      const res = NextResponse.json(
        { ok: false, error: "Failed to check bindings" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (bindings && bindings.length > 0) {
      const res = NextResponse.json(
        { ok: false, error: "Cannot deactivate: requirement is linked to existing bindings" },
        { status: 409 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabase
      .from("compliance_requirements")
      .update({
        is_active: false,
        updated_by: auth.userId,
      })
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[hr/requirements/catalog] deactivate error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to deactivate catalog item" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json(
        { ok: false, error: "Catalog item not found" },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const idempotencyKey = `REQ_CATALOG_DEACTIVATE:${auth.activeOrgId}:${id}`;
    const { error: govError } = await supabaseAdmin.from("governance_events").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      actor_user_id: auth.userId,
      action: "REQUIREMENT_CATALOG_DEACTIVATE",
      target_type: "REQUIREMENT_CATALOG",
      target_id: id,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_REQUIREMENT_CATALOG_V1"],
      meta: { is_active: false },
      idempotency_key: idempotencyKey,
    });

    if (govError && govError.code !== "23505") {
      console.error("[hr/requirements/catalog] governance_events insert failed", govError);
    }

    const res = NextResponse.json({ ok: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements/catalog] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
