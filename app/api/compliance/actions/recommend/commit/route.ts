/**
 * POST /api/compliance/actions/recommend/commit
 * P1.1 Recommended Actions Autopop — create recommended actions. Idempotent (no duplicates).
 * Body: { asOf?, expiringDays?, category?, line?, q?, maxCreate? } — maxCreate default 200.
 * Governed via withMutationGovernance (org-only).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";
import { computeRecommendations } from "@/lib/complianceRecommend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_MAX_CREATE = 200;

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
      return NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    }

    const asOfParam = typeof ctx.body.asOf === "string" ? ctx.body.asOf.trim() || null : null;
    const expiringDaysParam = ctx.body.expiringDays;
    const expiringDays = Number.isFinite(Number(expiringDaysParam))
      ? Math.max(0, Number(expiringDaysParam))
      : 30;
    const categoryParam = (typeof ctx.body.category === "string"
      ? ctx.body.category.trim() || "all"
      : "all") as "all" | "license" | "medical" | "contract";
    const line = typeof ctx.body.line === "string" ? ctx.body.line.trim() || null : null;
    const q = typeof ctx.body.q === "string" ? ctx.body.q.trim() || null : null;
    const maxCreateParam = ctx.body.maxCreate;
    const maxCreate =
      Number.isFinite(Number(maxCreateParam)) && Number(maxCreateParam) > 0
        ? Math.min(500, Math.max(1, Number(maxCreateParam)))
        : DEFAULT_MAX_CREATE;

    const asOf = asOfParam
      ? (() => {
          const d = new Date(asOfParam);
          return isNaN(d.getTime()) ? new Date() : d;
        })()
      : new Date();
    asOf.setHours(0, 0, 0, 0);

    const { recommendations } = await computeRecommendations(supabaseAdmin, {
      orgId: ctx.orgId,
      activeSiteId: ctx.siteId ?? null,
      asOf,
      expiringDays,
      category: categoryParam,
      line,
      q,
    });

    const toInsert = recommendations.slice(0, maxCreate);
    let createdCount = 0;

    for (const r of toInsert) {
      const site_id = ctx.siteId != null ? ctx.siteId : r.site_id;
      const row = {
        org_id: ctx.orgId,
        site_id,
        employee_id: r.employee_id,
        compliance_id: r.compliance_id,
        action_type: r.action_type,
        status: "open" as const,
        owner_user_id: ctx.userId,
        due_date: r.due_date,
        notes: null as string | null,
      };
      const { error } = await ctx.admin.from("compliance_actions").insert(row);
      if (error) {
        if (error.code !== "23505") {
          console.error("compliance/actions/recommend/commit insert", error);
          return NextResponse.json(
            errorPayload("insert", error.message, (error as { details?: string }).details),
            { status: 500 }
          );
        }
      } else {
        createdCount++;
      }
    }

    const skippedCount = recommendations.length - createdCount;
    return NextResponse.json({
      ok: true,
      createdCount,
      skippedCount,
    });
  },
  {
    route: "/api/compliance/actions/recommend/commit",
    action: "COMPLIANCE_RECOMMEND_COMMIT",
    target_type: "compliance_actions",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: "recommend-commit",
      meta: {
        category: typeof body.category === "string" ? body.category : "all",
        maxCreate: Number(body.maxCreate) || DEFAULT_MAX_CREATE,
      },
    }),
  }
);
