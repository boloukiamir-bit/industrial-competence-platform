/**
 * POST /api/compliance/actions/recommend/preview
 * P1.1 Recommended Actions Autopop — preview only. Admin/HR only. Same scoping as summary (activeSiteId strict).
 * Body: { asOf?, expiringDays?, category?, line?, q? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { isHrAdmin } from "@/lib/auth";
import { computeRecommendations } from "@/lib/complianceRecommend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PREVIEW_LIMIT = 200;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
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

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

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
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;
    const activeSiteName =
      activeSiteId != null ? await getActiveSiteName(supabaseAdmin, activeSiteId, orgId) : null;

    const { recommendations, skippedExistingTotal, byType } = await computeRecommendations(
      supabaseAdmin,
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

    const res = NextResponse.json({
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
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/actions/recommend/preview failed:", err);
    const res = NextResponse.json(errorPayload("compute", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
