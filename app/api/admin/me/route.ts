/**
 * GET /api/admin/me
 * Returns current user's email, active_org_id, and membership_role for the active org.
 * Uses org-scoped memberships.role (not profile.role). 403 if no active org or no membership.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status, headers: NO_CACHE_HEADERS });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, active_org_id")
      .eq("id", session.userId)
      .single();

    if (profileError || !profile) {
      const res = NextResponse.json(
        { error: "Profile not found" },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const activeOrgId = profile.active_org_id as string | null;
    if (!activeOrgId) {
      const res = NextResponse.json(
        { error: "No active organization" },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", activeOrgId)
      .eq("user_id", session.userId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      const res = NextResponse.json(
        { error: "No active membership for this organization" },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(
      {
        email: profile.email ?? null,
        active_org_id: activeOrgId,
        membership_role: membership.role,
      },
      { headers: NO_CACHE_HEADERS }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/me]", err);
    return NextResponse.json(
      { error: "Failed to load admin context" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
