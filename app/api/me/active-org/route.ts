/**
 * POST /api/me/active-org — set profile.active_org_id for the current user.
 * Body: { org_id: string }. User must have active membership in that org.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const orgId = typeof body.org_id === "string" ? body.org_id.trim() : null;
    if (!orgId) {
      const res = NextResponse.json({ error: "org_id required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("org_id")
      .eq("user_id", session.userId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      const res = NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active_org_id: orgId, active_site_id: null })
      .eq("id", session.userId);

    if (error) {
      console.error("[api/me/active-org]", error);
      const res = NextResponse.json({ error: "Failed to set active organization" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ active_org_id: orgId });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/me/active-org]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
