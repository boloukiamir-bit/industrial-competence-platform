import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/auth/getAuthedContext";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

/**
 * GET /api/debug/token
 * Non-production only. Admin-only.
 * Returns the current user's access_token for curl testing.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const ctx = await getAuthedContext(request);
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  let token = bearerMatch?.[1]?.trim() ?? null;
  if (token && token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1).trim();
  }

  if (!token) {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
    if (!token) {
      const res = NextResponse.json(
        { error: "No access_token found in session; use cookie auth or pass Authorization: Bearer" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const res = NextResponse.json({
      ok: true,
      access_token: token,
      method: "cookie",
      user_id: ctx.user.id,
      expires_at: data.session?.expires_at ?? null,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  return NextResponse.json({
    ok: true,
    access_token: token,
    method: "bearer",
    user_id: ctx.user.id,
  });
}
