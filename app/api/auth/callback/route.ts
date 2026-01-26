import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

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

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("auth/callback error:", err);
    return NextResponse.json({ error: "Failed to set session" }, { status: 500 });
  }
}
