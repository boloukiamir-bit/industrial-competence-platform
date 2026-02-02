/**
 * GET /api/me/session-debug — DEV only. Returns email, currentRole, active_org_id, active_site_id, PILOT_MODE.
 * In production returns 404. Used by Session Debug strip for quick verification.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { resolveAuthFromRequest } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const resolved = await resolveAuthFromRequest(request, { supabase });
    if (!resolved.ok || !resolved.user) {
      const errMsg = !resolved.ok && "error" in resolved ? resolved.error : "Not authenticated";
      const res = NextResponse.json(
        { error: errMsg, email: null, currentRole: null, active_org_id: null, active_site_id: null, pilotMode: process.env.NEXT_PUBLIC_PILOT_MODE === "true" },
        { status: 200 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile } = await resolved.supabase
      .from("profiles")
      .select("active_org_id, active_site_id")
      .eq("id", resolved.user.id)
      .single();

    let currentRole: string | null = null;
    const activeOrgId = (profile as { active_org_id?: string | null } | null)?.active_org_id ?? null;
    if (activeOrgId) {
      const { data: membership } = await resolved.supabase
        .from("memberships")
        .select("role")
        .eq("user_id", resolved.user.id)
        .eq("org_id", activeOrgId)
        .eq("status", "active")
        .maybeSingle();
      currentRole = (membership as { role?: string } | null)?.role ?? null;
    }

    const payload = {
      email: resolved.user.email ?? null,
      currentRole,
      active_org_id: activeOrgId,
      active_site_id: (profile as { active_site_id?: string | null } | null)?.active_site_id ?? null,
      pilotMode: process.env.NEXT_PUBLIC_PILOT_MODE === "true",
    };

    const res = NextResponse.json(payload);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/me/session-debug]", err);
    return NextResponse.json(
      { error: "Internal error", email: null, currentRole: null, active_org_id: null, active_site_id: null, pilotMode: false },
      { status: 200 }
    );
  }
}
