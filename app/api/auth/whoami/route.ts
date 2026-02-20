/**
 * GET /api/auth/whoami
 * Diagnostic endpoint: auth status and cookie visibility for curl debugging.
 * Same SSR supabase client as other routes; use request.cookies for explicit curl support.
 * In DEVELOPMENT only: Authorization: Bearer <DEV_BEARER_TOKEN> is accepted (no cookies).
 *
 * Returns:
 *   { authenticated, user?: { id, email }, active_org_id?, active_site_id?, role?, cookies_present, expected_auth_cookie, error? }
 *
 * Curl example:
 *   curl -s "http://localhost:5001/api/auth/whoami" -H "Cookie: sb-<ref>-auth-token=<value>"
 *   curl -s "http://localhost:5001/api/auth/whoami" -H "Authorization: Bearer $DEV_BEARER_TOKEN"  # dev only
 */
import { NextRequest, NextResponse } from "next/server";
import { getDevBearerContext } from "@/lib/server/auth";
import {
  createSupabaseServerClient,
  applySupabaseCookies,
  getExpectedAuthCookieName,
} from "@/lib/supabase/server";

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

export async function GET(request: NextRequest) {
  try {
    if (!isProduction) {
      const devCtx = await getDevBearerContext(request);
      if (devCtx) {
        const cookieNames =
          typeof request.cookies?.getAll === "function"
            ? request.cookies.getAll().map((c) => c.name)
            : [];
        return NextResponse.json({
          authenticated: true,
          email: devCtx.email ?? null,
          user_id: devCtx.userId,
          active_org_id: devCtx.active_org_id,
          active_site_id: devCtx.active_site_id,
          role: devCtx.role,
          user: { id: devCtx.userId, email: devCtx.email ?? null },
          cookies_present: cookieNames,
          expected_auth_cookie: getExpectedAuthCookieName(),
          has_auth_cookie: false,
        });
      }
    }

    const cookieNames =
      typeof request.cookies?.getAll === "function"
        ? request.cookies.getAll().map((c) => c.name)
        : [];
    const expectedAuth = getExpectedAuthCookieName();
    const hasAuthCookie =
      cookieNames.includes(expectedAuth) || cookieNames.some((n) => n.startsWith(`${expectedAuth}.`));

    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const res = NextResponse.json(
        {
          authenticated: false,
          cookies_present: cookieNames,
          expected_auth_cookie: expectedAuth,
          has_auth_cookie: hasAuthCookie,
          error: error.message,
        },
        { status: 200 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!data.user) {
      const res = NextResponse.json(
        {
          authenticated: false,
          cookies_present: cookieNames,
          expected_auth_cookie: expectedAuth,
          has_auth_cookie: hasAuthCookie,
          error: "No user in session",
        },
        { status: 200 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      authenticated: true,
      user: { id: data.user.id, email: data.user.email ?? null },
      cookies_present: cookieNames,
      expected_auth_cookie: expectedAuth,
      has_auth_cookie: hasAuthCookie,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[auth/whoami] error:", err);
    return NextResponse.json(
      {
        authenticated: false,
        cookies_present: [] as string[],
        expected_auth_cookie: getExpectedAuthCookieName(),
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
