/**
 * GET /api/hr/owners — org members for owner dropdown (user_id, email).
 * Tenant-scoped via getActiveOrgFromSession.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const admin = getSupabaseAdmin();
  const { data: members, error: mErr } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", org.activeOrgId)
    .eq("status", "active");
  if (mErr) {
    const res = NextResponse.json({ error: mErr.message }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const memberList = (members ?? []) as { user_id: string }[];
  const userIds = memberList.map((m) => m.user_id).filter(Boolean);
  if (userIds.length === 0) {
    const res = NextResponse.json({ owners: [] });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);
  if (pErr) {
    const res = NextResponse.json({ error: pErr.message }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const profileList = (profiles ?? []) as { id: string; email: string | null }[];
  const owners = profileList.map((p) => ({
    userId: p.id,
    email: p.email ?? "",
  }));
  const res = NextResponse.json({ owners });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
