/**
 * POST /api/admin/users/repair-access
 * Admin or HR only. Body: { email, orgId, role, siteId? }.
 * Finds user by email, upserts membership (role, status=active), upserts profile (active_org_id, active_site_id).
 * Pilot rescue tool; no sensitive links returned in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { getServiceSupabase } from "@/lib/server/adminUsers";
import { validateActiveSiteIdForOrg } from "@/lib/server/validateActiveSite";

const repairSchema = z.object({
  email: z.string().email(),
  orgId: z.string().uuid(),
  role: z.enum(["admin", "hr", "manager", "user"]),
  siteId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      if (auth.debugHeader) res.headers.set("x-auth-debug", auth.debugHeader);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const parsed = repairSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, orgId, role, siteId } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const admin = getServiceSupabase();
    const rawSiteId = siteId ?? auth.activeSiteId ?? null;
    const activeSiteId = await validateActiveSiteIdForOrg(admin, rawSiteId, orgId);

    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = listData?.users ?? [];
    const user = users.find((u) => (u.email ?? "").toLowerCase() === normalizedEmail);
    if (!user?.id) {
      return NextResponse.json({ error: "User not found for this email" }, { status: 404 });
    }

    const { error: membershipError } = await admin
      .from("memberships")
      .upsert(
        { org_id: orgId, user_id: user.id, role, status: "active" },
        { onConflict: "org_id,user_id" }
      );
    if (membershipError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[admin/users/repair-access] membership error:", membershipError.message);
      }
      const res = NextResponse.json(
        { error: "Failed to update membership" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: normalizedEmail,
          active_org_id: orgId,
          active_site_id: activeSiteId,
        },
        { onConflict: "id" }
      );
    if (profileError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[admin/users/repair-access] profile error:", profileError.message);
      }
      const res = NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[admin/users/repair-access] repaired:", {
        email: normalizedEmail,
        org_id: orgId,
        role,
        active_site_id: activeSiteId,
      });
    }

    const res = NextResponse.json({
      ok: true,
      email: normalizedEmail,
      userId: user.id,
      orgId,
      role,
      activeSiteId,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (process.env.NODE_ENV !== "production") {
      console.error("[admin/users/repair-access] error:", message);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
