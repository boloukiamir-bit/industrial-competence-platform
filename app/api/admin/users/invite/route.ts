/**
 * POST /api/admin/users/invite
 * Auth: org admin or hr (active org from session). Uses service role server-side only.
 * Body: { email: string, role: "admin"|"hr"|"manager"|"user" }
 * Creates user if new, generates invite or recovery link, upserts membership.
 * Returns link only in non-production.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import {
  checkInviteRateLimit,
  getServiceSupabase,
  getRedirectBase,
  isProduction,
} from "@/lib/server/adminUsers";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "hr", "manager", "user"]),
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
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    if (checkInviteRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please wait before sending another invite for this email" },
        { status: 429 }
      );
    }

    const redirectBase = getRedirectBase();
    const redirectTo = redirectBase ? `${redirectBase}/app` : undefined;

    const admin = getServiceSupabase();
    const orgId = auth.activeOrgId;

    // Find existing user by email (listUsers then filter)
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = listData?.users ?? [];
    const existing = users.find((u) => (u.email ?? "").toLowerCase() === normalizedEmail);

    let userId: string;
    let action: "invited" | "recovery";

    if (existing) {
      userId = existing.id;
      action = "recovery";
    } else {
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      });
      if (createError) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[admin/users/invite] createUser error:", createError.message);
        }
        const res = NextResponse.json(
          { error: createError.message || "Failed to create user" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (!createData?.user?.id) {
        const res = NextResponse.json({ error: "Failed to create user" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      userId = createData.user.id;
      action = "invited";
    }

    const linkType = action === "invited" ? "invite" : "recovery";
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: linkType,
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[admin/users/invite] generateLink error:", linkError.message);
      }
      const res = NextResponse.json(
        { error: linkError.message || "Failed to generate link" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Upsert membership for active org
    const { error: membershipError } = await admin
      .from("memberships")
      .upsert(
        { org_id: orgId, user_id: userId, role, status: "active" },
        { onConflict: "org_id,user_id" }
      );

    if (membershipError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[admin/users/invite] membership upsert error:", membershipError.message);
      }
      const res = NextResponse.json(
        { error: "User created but failed to add to organization" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Inviter's active org/site so invited user lands in same context
    const activeSiteId = auth.activeSiteId ?? null;
    const profilePayload: { id: string; email: string; active_org_id: string; active_site_id?: string | null } = {
      id: userId,
      email: normalizedEmail,
      active_org_id: orgId,
      active_site_id: activeSiteId,
    };

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[admin/users/invite] profile upsert error:", profileError.message);
      }
      // Non-fatal: membership is set; user can set org from UI
    } else if (process.env.NODE_ENV !== "production") {
      console.info("[admin/users/invite] verified:", {
        invitedEmail: normalizedEmail,
        org_id: orgId,
        role,
        active_site_id: activeSiteId,
      });
    }

    const payload: {
      ok: true;
      userId: string;
      email: string;
      role: string;
      action: "invited" | "recovery";
      linkSent?: boolean;
      link?: string;
    } = {
      ok: true,
      userId,
      email: normalizedEmail,
      role,
      action,
      linkSent: true,
    };

    if (!isProduction() && linkData?.properties?.action_link) {
      payload.link = linkData.properties.action_link;
      // Never log full link in production (already guarded by isProduction)
    }

    const res = NextResponse.json(payload);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (process.env.NODE_ENV !== "production") {
      console.error("[admin/users/invite] error:", message);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
