/**
 * POST /api/hr/requirements/catalog/upsert
 * Create or update compliance_requirements catalog item. Auth: requireAdminOrHr. Tenant: activeOrgId.
 * Body: id?, code, name, category?, description?, criticality?, is_active?
 * Idempotent by (org_id, code) when no id. Writes governance_events REQUIREMENT_CATALOG_UPSERT.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const CRITICALITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

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

  const id = typeof body.id === "string" ? body.id.trim() || undefined : undefined;
  const codeRaw = typeof body.code === "string" ? body.code.trim() : "";
  const code = codeRaw.toUpperCase();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category =
    body.category == null || body.category === ""
      ? null
      : typeof body.category === "string"
        ? body.category.trim() || null
        : null;
  const description =
    body.description == null || body.description === ""
      ? null
      : typeof body.description === "string"
        ? body.description.trim() || null
        : null;
  const criticalityRaw =
    typeof body.criticality === "string" && CRITICALITY_VALUES.includes(body.criticality as (typeof CRITICALITY_VALUES)[number])
      ? (body.criticality as (typeof CRITICALITY_VALUES)[number])
      : "MEDIUM";
  const is_active = body.is_active === false ? false : true;

  if (!code || !name) {
    const res = NextResponse.json(
      { ok: false, error: "code and name are required and non-empty" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    let rowId: string;

    if (id) {
      const { data: updated, error } = await supabase
        .from("compliance_requirements")
        .update({
          code,
          name,
          category,
          description,
          criticality: criticalityRaw,
          is_active,
          updated_by: auth.userId,
        })
        .eq("id", id)
        .eq("org_id", auth.activeOrgId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[hr/requirements/catalog/upsert] update error", error);
        const res = NextResponse.json(
          { ok: false, error: error.message || "Failed to update catalog item" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (!updated) {
        const res = NextResponse.json(
          { ok: false, error: "Catalog item not found" },
          { status: 404 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      rowId = updated.id;
    } else {
      const { data: upserted, error } = await supabase
        .from("compliance_requirements")
        .upsert(
          {
            org_id: auth.activeOrgId,
            site_id: auth.activeSiteId ?? null,
            code,
            name,
            category,
            description,
            criticality: criticalityRaw,
            is_active,
            created_by: auth.userId,
            updated_by: auth.userId,
          },
          { onConflict: "org_id,code" }
        )
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[hr/requirements/catalog/upsert] upsert error", error);
        const res = NextResponse.json(
          { ok: false, error: error.message || "Failed to create catalog item" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (upserted?.id) {
        rowId = upserted.id;
      } else {
        const { data: existing } = await supabase
          .from("compliance_requirements")
          .select("id")
          .eq("org_id", auth.activeOrgId)
          .eq("code", code)
          .maybeSingle();
        rowId = existing?.id ?? "";
      }
    }

    const idempotencyKey = `REQ_CATALOG_UPSERT:${auth.activeOrgId}:${code}:${criticalityRaw}:${is_active}`;
    const { error: govError } = await supabaseAdmin.from("governance_events").insert({
      org_id: auth.activeOrgId,
      site_id: auth.activeSiteId ?? null,
      actor_user_id: auth.userId,
      action: "REQUIREMENT_CATALOG_UPSERT",
      target_type: "REQUIREMENT_CATALOG",
      target_id: rowId,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_REQUIREMENT_CATALOG_V1"],
      meta: { code, name, category, description, criticality: criticalityRaw, is_active },
      idempotency_key: idempotencyKey,
    });

    if (govError && govError.code !== "23505") {
      console.error("[hr/requirements/catalog/upsert] governance_events insert failed", govError);
    }

    const res = NextResponse.json({ ok: true, id: rowId });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements/catalog/upsert] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
