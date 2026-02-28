import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const DEFAULT_POST_LOGIN_PATH = "/app/cockpit";

/**
 * GET /api/auth/callback
 * Magic link / OAuth callback: exchange code for session, set cookies, redirect to app.
 * Query: code (from Supabase redirect), next (optional safe redirect path).
 */
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const nextPath = requestUrl.searchParams.get("next")?.trim();

    if (!code) {
      const redirectUrl = new URL("/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "missing_code");
      return NextResponse.redirect(redirectUrl.toString(), 302);
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error", error.message);
      const redirectUrl = new URL("/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "exchange_failed");
      return NextResponse.redirect(redirectUrl.toString(), 302);
    }

    const redirectPath =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("http")
        ? nextPath
        : DEFAULT_POST_LOGIN_PATH;
    if (redirectPath === "/login" || redirectPath.startsWith("/login?")) {
      return NextResponse.redirect(new URL(DEFAULT_POST_LOGIN_PATH, requestUrl.origin).toString(), 302);
    }

    const res = NextResponse.redirect(new URL(redirectPath, requestUrl.origin).toString(), 302);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[auth/callback] GET error:", err);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(
      new URL("/login?error=callback_error", requestUrl.origin).toString(),
      302
    );
  }
}

/**
 * POST /api/auth/callback
 * Syncs the Supabase auth session to cookies so server/API routes can read it.
 * Call this after client-side signIn: send { access_token, refresh_token } from
 * the session. The response includes Set-Cookie headers for sb-* keys.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const access_token = body?.access_token as string | undefined;
    const refresh_token = body?.refresh_token as string | undefined;

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "access_token and refresh_token are required" },
        { status: 400 }
      );
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("auth/callback POST error:", err);
    return NextResponse.json({ error: "Failed to set session" }, { status: 500 });
  }
}
