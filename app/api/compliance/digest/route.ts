/**
 * GET /api/compliance/digest — daily HR digest (live). Admin/HR only. Tenant: getActiveOrgFromSession.
 * Params: asOf (default today), expiringDays (default 30). If activeSiteId set, filter by site.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { isHrAdmin } from "@/lib/auth";
import { buildDigestPayload } from "@/lib/server/complianceDigest";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const asOfParam = searchParams.get("asOf")?.trim() || null;
  const expiringDaysParam = searchParams.get("expiringDays");
  const expiringDays = Number.isFinite(parseInt(expiringDaysParam ?? "", 10))
    ? Math.max(0, parseInt(expiringDaysParam!, 10))
    : 30;

  const asOf = asOfParam
    ? (() => {
        const d = new Date(asOfParam);
        return isNaN(d.getTime()) ? new Date() : d;
      })()
    : new Date();

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;
    const activeSiteName =
      activeSiteId != null ? await getActiveSiteName(supabaseAdmin, activeSiteId, orgId) : null;

    const payload = await buildDigestPayload(
      supabaseAdmin,
      orgId,
      activeSiteId,
      asOf,
      expiringDays,
      activeSiteName
    );

    const res = NextResponse.json({ ok: true, ...payload });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/digest failed:", err);
    const res = NextResponse.json(errorPayload("digest", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
