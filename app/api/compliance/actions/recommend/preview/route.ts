/**
 * POST /api/compliance/actions/recommend/preview
 * P1.1 Recommended Actions Autopop — preview only. Admin/HR only.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";
import { getActiveSiteName } from "@/lib/server/siteName";
import { computeRecommendations } from "@/lib/complianceRecommend";

const PREVIEW_LIMIT = 200;

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

    const body = ctx.body;
    const asOfParam = typeof body.asOf === "string" ? body.asOf.trim() || null : null;
    const expiringDaysParam = body.expiringDays;
    const expiringDays = Number.isFinite(Number(expiringDaysParam))
      ? Math.max(0, Number(expiringDaysParam))
      : 30;
    const categoryParam = (typeof body.category === "string" ? body.category.trim() || "all" : "all") as
      | "all"
      | "license"
      | "medical"
      | "contract";
    const line = typeof body.line === "string" ? body.line.trim() || null : null;
    const q = typeof body.q === "string" ? body.q.trim() || null : null;

    const asOf = asOfParam
      ? (() => {
          const d = new Date(asOfParam);
          return isNaN(d.getTime()) ? new Date() : d;
        })()
      : new Date();
    asOf.setHours(0, 0, 0, 0);

    try {
      const orgId = ctx.orgId;
      const activeSiteId = ctx.siteId ?? null;
      const activeSiteName =
        activeSiteId != null ? await getActiveSiteName(ctx.admin, activeSiteId, orgId) : null;

      const { recommendations, skippedExistingTotal, byType } = await computeRecommendations(
        ctx.admin,
        {
          orgId,
          activeSiteId,
          asOf,
          expiringDays,
          category: categoryParam,
          line,
          q,
        }
      );

      const preview = recommendations.slice(0, PREVIEW_LIMIT).map((r) => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        compliance_code: r.compliance_code,
        compliance_name: r.compliance_name,
        reason: r.reason,
        action_type: r.action_type,
        due_date: r.due_date,
      }));

      return NextResponse.json({
        ok: true,
        context: {
          activeSiteId,
          activeSiteName,
          asOf: asOf.toISOString().slice(0, 10),
          expiringDays,
        },
        counts: {
          willCreateTotal: recommendations.length,
          skippedExistingTotal,
        },
        byType,
        preview,
      });
    } catch (err) {
      console.error("POST /api/compliance/actions/recommend/preview failed:", err);
      return NextResponse.json(errorPayload("compute", err), { status: 500 });
    }
  },
  {
    route: "/api/compliance/actions/recommend/preview",
    action: "COMPLIANCE_RECOMMEND_PREVIEW",
    target_type: "compliance_action",
    allowNoShiftContext: true,
  }
);
