/**
 * GET /api/admin/me
 * Returns current user's email, active_org_id, active_site_id, and membership_role.
 * Uses getActiveOrgFromSession (bootstraps org/site when missing). 403 if no active org or no membership.
 * In DEVELOPMENT only: Authorization: Bearer <DEV_BEARER_TOKEN> is accepted (no cookies).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDevBearerContext } from "@/lib/server/auth";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    if (!isProduction) {
      const devCtx = await getDevBearerContext(request);
      if (devCtx) {
        if (!devCtx.active_org_id || devCtx.role === null) {
          const { pendingCookies } = await createSupabaseServerClient(request);
          const res = NextResponse.json(
            {
              error: devCtx.active_org_id ? "No active membership for this organization" : "No active organization",
              code: "ORG_CONTEXT_REQUIRED",
            },
            { status: 403, headers: NO_CACHE_HEADERS }
          );
          applySupabaseCookies(res, pendingCookies);
          return res;
        }
        const res = NextResponse.json(
          {
            email: devCtx.email ?? null,
            active_org_id: devCtx.active_org_id,
            active_site_id: devCtx.active_site_id ?? null,
            membership_role: devCtx.role,
          },
          { headers: NO_CACHE_HEADERS }
        );
        return res;
      }
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { error: org.error, code: org.status === 403 ? "ORG_CONTEXT_REQUIRED" : undefined },
        { status: org.status, headers: NO_CACHE_HEADERS }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", org.userId)
      .single();

    if (profileError || !profile) {
      const res = NextResponse.json(
        { error: "Profile not found", code: "ORG_CONTEXT_REQUIRED" },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", org.activeOrgId)
      .eq("user_id", org.userId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      const res = NextResponse.json(
        { error: "No active membership for this organization", code: "ORG_CONTEXT_REQUIRED" },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(
      {
        email: (profile as { email?: string | null }).email ?? null,
        active_org_id: org.activeOrgId,
        active_site_id: org.activeSiteId,
        membership_role: (membership as { role?: string }).role,
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
