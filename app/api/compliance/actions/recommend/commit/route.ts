/**
 * POST /api/compliance/actions/recommend/commit
 * P1.1 Recommended Actions Autopop — create recommended actions. Idempotent (no duplicates).
 * Body: { asOf?, expiringDays?, category?, line?, q?, maxCreate? } — maxCreate default 200.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
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
  const maxCreateParam = body.maxCreate;
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

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    const { recommendations } = await computeRecommendations(supabaseAdmin, {
      orgId,
      activeSiteId,
      asOf,
      expiringDays,
      category: categoryParam,
      line,
      q,
    });

    const toInsert = recommendations.slice(0, maxCreate);
    let createdCount = 0;

    for (const r of toInsert) {
      const site_id = activeSiteId != null ? activeSiteId : r.site_id;
      const row = {
        org_id: orgId,
        site_id,
        employee_id: r.employee_id,
        compliance_id: r.compliance_id,
        action_type: r.action_type,
        status: "open" as const,
        owner_user_id: org.userId,
        due_date: r.due_date,
        notes: null as string | null,
      };
      const { error } = await supabaseAdmin.from("compliance_actions").insert(row);
      if (error) {
        // Unique constraint violation => already exists (idempotent skip)
        if (error.code !== "23505") {
          console.error("compliance/actions/recommend/commit insert", error);
          const res = NextResponse.json(
            errorPayload("insert", error.message, error.details ?? undefined),
            { status: 500 }
          );
          applySupabaseCookies(res, pendingCookies);
          return res;
        }
      } else {
        createdCount++;
      }
    }

    const skippedCount = recommendations.length - createdCount;

    const res = NextResponse.json({
      ok: true,
      createdCount,
      skippedCount,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/actions/recommend/commit failed:", err);
    const res = NextResponse.json(errorPayload("compute", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
