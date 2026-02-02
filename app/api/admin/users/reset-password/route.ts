/**
 * POST /api/admin/users/reset-password
 * Auth: org admin or hr (active org from session). Uses service role server-side only.
 * Body: { email: string }
 * Generates recovery link. Returns link only in non-production.
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

const resetSchema = z.object({
  email: z.string().email(),
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
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    if (checkInviteRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please wait before sending another reset for this email" },
        { status: 429 }
      );
    }

    const redirectBase = getRedirectBase();
    const redirectTo = redirectBase ? `${redirectBase}/app` : undefined;

    const admin = getServiceSupabase();
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[admin/users/reset-password] generateLink error:", linkError.message);
      }
      const res = NextResponse.json(
        { error: linkError.message || "Failed to generate reset link" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const payload: {
      ok: true;
      email: string;
      linkSent?: boolean;
      link?: string;
    } = {
      ok: true,
      email: normalizedEmail,
      linkSent: true,
    };

    if (!isProduction() && linkData?.properties?.action_link) {
      payload.link = linkData.properties.action_link;
    }

    const res = NextResponse.json(payload);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (process.env.NODE_ENV !== "production") {
      console.error("[admin/users/reset-password] error:", message);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
