/**
 * GET /api/debug/session-health
 * Deterministic session validity for cockpit. Uses same cookie-based server client as cockpit APIs.
 * No auth header; cookie-based only. Call applySupabaseCookies so token refresh is persisted.
 * When has_session: includes active_org_id, active_site_id (and bootstrapped) for debugging.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const SB_AUTH_COOKIE_RE = /^sb-[a-z0-9]+-auth-token$/i;

export type SessionHealthResponse = {
  ok: true;
  has_session: boolean;
  user: { id: string; email: string | null } | null;
  error: string | null;
  cookie_present: boolean;
  now: string;
  active_org_id?: string | null;
  active_site_id?: string | null;
  bootstrapped?: boolean;
};

export async function GET(request: NextRequest) {
  const now = new Date().toISOString();
  const cookieNames =
    typeof request.cookies?.getAll === "function"
      ? request.cookies.getAll().map((c) => c.name)
      : [];
  const cookie_present = cookieNames.some((name) => SB_AUTH_COOKIE_RE.test(name));

  let body: SessionHealthResponse;

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const has_session = !error && !!user;
    body = {
      ok: true,
      has_session,
      user: user ? { id: user.id, email: user.email ?? null } : null,
      error: error?.message ?? null,
      cookie_present,
      now,
    };

    if (has_session && user) {
      const org = await getActiveOrgFromSession(request, supabase);
      if (org.ok) {
        body.active_org_id = org.activeOrgId;
        body.active_site_id = org.activeSiteId;
        if (org.bootstrapped) body.bootstrapped = true;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[session-health]", JSON.stringify(body));
    }

    const res = NextResponse.json(body, { status: 200 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    body = {
      ok: true,
      has_session: false,
      user: null,
      error: message,
      cookie_present,
      now,
    };
    if (process.env.NODE_ENV !== "production") {
      console.log("[session-health]", JSON.stringify(body));
    }
    return NextResponse.json(body, { status: 200 });
  }
}
