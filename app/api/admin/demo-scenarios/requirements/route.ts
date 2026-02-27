/**
 * POST /api/admin/demo-scenarios/requirements
 * Safe demo scenario for Requirement Governance V1: seed or remove SAFETY_BASIC + OPERATOR rule.
 * Auth: requireAdminOrHr. Tenant: activeOrgId. Reversible; does not delete bindings.
 * Body: { action: "seed" | "remove" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const DEMO_REQUIREMENT_CODE = "SAFETY_BASIC";
const DEMO_REQUIREMENT_NAME = "Safety basic";
const DEMO_ROLE = "OPERATOR";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const action = body.action === "seed" || body.action === "remove" ? body.action : null;
  if (!action) {
    const res = NextResponse.json(
      { ok: false, error: "body.action must be 'seed' or 'remove'" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    if (action === "seed") {
      const { data: upserted, error: catalogError } = await supabase
        .from("compliance_requirements")
        .upsert(
          {
            org_id: auth.activeOrgId,
            site_id: auth.activeSiteId ?? null,
            code: DEMO_REQUIREMENT_CODE,
            name: DEMO_REQUIREMENT_NAME,
            category: null,
            description: null,
            criticality: "CRITICAL",
            is_active: true,
            created_by: auth.userId,
            updated_by: auth.userId,
          },
          { onConflict: "org_id,code" }
        )
        .select("id")
        .maybeSingle();

      if (catalogError) {
        console.error("[demo-scenarios/requirements] catalog upsert error", catalogError);
        const res = NextResponse.json(
          { ok: false, error: "Failed to upsert catalog requirement" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const { error: ruleError } = await supabase.rpc("create_requirement_rule_v1", {
        p_org_id: auth.activeOrgId,
        p_role: DEMO_ROLE,
        p_requirement_code: DEMO_REQUIREMENT_CODE,
        p_requirement_name: DEMO_REQUIREMENT_NAME,
        p_is_mandatory: true,
        p_idempotency_key: null,
        p_criticality_override: "CRITICAL",
      });

      if (ruleError && ruleError.code !== "23505") {
        console.error("[demo-scenarios/requirements] create_requirement_rule_v1 error", ruleError);
        const res = NextResponse.json(
          { ok: false, error: ruleError.message ?? "Failed to create rule" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const idempotencyKey = `DEMO_SCENARIO_REQUIREMENTS:${auth.activeOrgId}:seed`;
      const { error: govError } = await supabaseAdmin.from("governance_events").insert({
        org_id: auth.activeOrgId,
        site_id: auth.activeSiteId ?? null,
        actor_user_id: auth.userId,
        action: "DEMO_SCENARIO_REQUIREMENTS_SEED",
        target_type: "REQUIREMENT_CATALOG",
        target_id: upserted?.id ?? "",
        outcome: "RECORDED",
        legitimacy_status: "OK",
        readiness_status: "NON_BLOCKING",
        reason_codes: ["COMPLIANCE_REQUIREMENT_RULES_V1"],
        meta: { requirement_code: DEMO_REQUIREMENT_CODE, role: DEMO_ROLE },
        idempotency_key: idempotencyKey,
      });
      if (govError && govError.code !== "23505") {
        console.error("[demo-scenarios/requirements] governance_events insert failed", govError);
      }

      const res = NextResponse.json({ ok: true, seeded: true });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (action === "remove") {
      const { data: rule, error: ruleFetchError } = await supabase
        .from("requirement_role_rules")
        .select("id")
        .eq("org_id", auth.activeOrgId)
        .eq("role", DEMO_ROLE)
        .eq("requirement_code", DEMO_REQUIREMENT_CODE)
        .maybeSingle();

      if (ruleFetchError) {
        console.error("[demo-scenarios/requirements] rule fetch error", ruleFetchError);
        const res = NextResponse.json(
          { ok: false, error: "Failed to find rule" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      if (rule?.id) {
        const { error: deleteError } = await supabase.rpc("delete_requirement_rule_v1", {
          p_org_id: auth.activeOrgId,
          p_rule_id: rule.id,
          p_idempotency_key: null,
        });
        if (deleteError) {
          console.error("[demo-scenarios/requirements] delete_requirement_rule_v1 error", deleteError);
          const res = NextResponse.json(
            { ok: false, error: deleteError.message ?? "Failed to delete rule" },
            { status: 500 }
          );
          applySupabaseCookies(res, pendingCookies);
          return res;
        }
      }

      const { data: catalogRow } = await supabase
        .from("compliance_requirements")
        .select("id")
        .eq("org_id", auth.activeOrgId)
        .eq("code", DEMO_REQUIREMENT_CODE)
        .maybeSingle();

      let catalogDeactivated = false;
      if (catalogRow?.id) {
        const { data: bindings } = await supabase
          .from("employee_requirement_bindings")
          .select("id")
          .eq("org_id", auth.activeOrgId)
          .eq("requirement_code", DEMO_REQUIREMENT_CODE)
          .limit(1);

        if (!bindings?.length) {
          const { error: updateError } = await supabase
            .from("compliance_requirements")
            .update({ is_active: false, updated_by: auth.userId })
            .eq("id", catalogRow.id)
            .eq("org_id", auth.activeOrgId);
          if (!updateError) catalogDeactivated = true;
        }
      }

      const idempotencyKey = `DEMO_SCENARIO_REQUIREMENTS:${auth.activeOrgId}:remove`;
      const { error: govError } = await supabaseAdmin.from("governance_events").insert({
        org_id: auth.activeOrgId,
        site_id: auth.activeSiteId ?? null,
        actor_user_id: auth.userId,
        action: "DEMO_SCENARIO_REQUIREMENTS_REMOVE",
        target_type: "REQUIREMENT_CATALOG",
        target_id: catalogRow?.id ?? "",
        outcome: "RECORDED",
        legitimacy_status: "OK",
        readiness_status: "NON_BLOCKING",
        reason_codes: ["COMPLIANCE_REQUIREMENT_RULES_V1"],
        meta: { catalogDeactivated },
        idempotency_key: idempotencyKey,
      });
      if (govError && govError.code !== "23505") {
        console.error("[demo-scenarios/requirements] governance_events insert failed", govError);
      }

      const res = NextResponse.json({ ok: true, removed: true, catalogDeactivated });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[demo-scenarios/requirements] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
