import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAuthFromRequest } from "@/lib/server/auth";

/**
 * GET /api/debug/auth
 * Non-production only. Returns { ok, userId, email, active_org_id, membership_role, auth } for cookie or bearer auth.
 */
export async function GET(request: NextRequest) {
  const isProd =
    process.env.NODE_ENV === "production" ||
    (process.env.VERCEL_ENV as string) === "production";
  if (isProd) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const resolved = await resolveAuthFromRequest(request);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 401 });
  }

  const { data: profile } = await resolved.supabase
    .from("profiles")
    .select("active_org_id, active_site_id")
    .eq("id", resolved.user.id)
    .single();

  const activeOrgId = profile?.active_org_id ?? null;
  let membership_role: string | null = null;
  if (activeOrgId) {
    const { data: membership } = await resolved.supabase
      .from("memberships")
      .select("role")
      .eq("org_id", activeOrgId)
      .eq("user_id", resolved.user.id)
      .eq("status", "active")
      .maybeSingle();
    membership_role = membership?.role ?? null;
  }

  return NextResponse.json({
    ok: true,
    userId: resolved.user.id,
    email: resolved.user.email ?? null,
    active_org_id: activeOrgId,
    active_site_id: profile?.active_site_id ?? null,
    membership_role,
    role: membership_role,
    auth: resolved.authType,
  });
}
