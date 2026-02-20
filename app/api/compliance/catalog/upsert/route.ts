/**
 * POST /api/compliance/catalog/upsert — upsert catalog item by (org_id, code). Admin/HR only.
 * Body: { code, name, category, description?, default_validity_days?, site_id?, is_active? }
 * Governed via withMutationGovernance (org-only).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

const CATEGORIES = ["license", "medical", "contract"] as const;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export const POST = withMutationGovernance(
  async (ctx) => {
    const { data: membership } = await ctx.supabase
      .from("memberships")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("org_id", ctx.orgId)
      .eq("status", "active")
      .maybeSingle();

    if (!isHrAdmin(membership?.role)) {
      return NextResponse.json(
        { ok: false as const, step: "forbidden", error: "Admin or HR role required" },
        { status: 403 }
      );
    }

    const code = typeof ctx.body.code === "string" ? ctx.body.code.trim() : "";
    const name = typeof ctx.body.name === "string" ? ctx.body.name.trim() : "";
    const category =
      typeof ctx.body.category === "string" &&
      (CATEGORIES as readonly string[]).includes(ctx.body.category)
        ? ctx.body.category
        : null;
    if (!code || !name || !category) {
      return NextResponse.json(
        errorPayload(
          "validation",
          "code, name, and category (license|medical|contract) are required"
        ),
        { status: 400 }
      );
    }

    const description =
      typeof ctx.body.description === "string" ? ctx.body.description.trim() || null : null;
    const default_validity_days =
      typeof ctx.body.default_validity_days === "number" ? ctx.body.default_validity_days : null;
    const site_id = typeof ctx.body.site_id === "string" ? ctx.body.site_id || null : null;
    const is_active = ctx.body.is_active !== false;

    const row = {
      org_id: ctx.orgId,
      site_id,
      category,
      code,
      name,
      description,
      default_validity_days,
      is_active,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await ctx.supabase
      .from("compliance_catalog")
      .upsert(row, { onConflict: "org_id,code", ignoreDuplicates: false })
      .select(
        "id, org_id, site_id, category, code, name, description, default_validity_days, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("compliance/catalog/upsert", { step: "upsert", error });
      return NextResponse.json(
        errorPayload("upsert", error.message, (error as { details?: string }).details),
        { status: 500 }
      );
    }

    const item = data
      ? {
          id: data.id,
          org_id: data.org_id,
          site_id: data.site_id ?? null,
          category: data.category,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          default_validity_days: data.default_validity_days ?? null,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }
      : null;

    return NextResponse.json({ ok: true, item });
  },
  {
    route: "/api/compliance/catalog/upsert",
    action: "COMPLIANCE_CATALOG_UPSERT",
    target_type: "compliance_catalog",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id:
        typeof body.code === "string" ? `catalog:${body.code}` : "unknown",
      meta: {
        category: typeof body.category === "string" ? body.category : "",
      },
    }),
  }
);
