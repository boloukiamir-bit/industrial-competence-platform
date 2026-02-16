/**
 * Auth bootstrap for Next.js App Router route handlers.
 * Resolves user from (A) cookie-based SSR session or (B) Authorization: Bearer <token>.
 * Loads profile (active_org_id, active_site_id) and membership role; enforces admin or hr.
 * Use for admin routes that must work in browser (cookies) and curl/CLI (Bearer).
 */
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CookieToSet } from "@/lib/supabase/server";

/** Debug info for Bearer 401 (non-production only). */
export type BearerDebug = {
  hasAuthHeader: boolean;
  authHeaderPrefix: string;
  tokenLooksLikeJwt: boolean;
  tokenLen: number;
  methodAError: string | null;
  methodBError: string | null;
};

export type AuthedContext =
  | {
      ok: true;
      user: User;
      orgId: string;
      siteId: string | null;
      role: string;
      pendingCookies: CookieToSet[];
    }
  | { ok: false; error: string; status: 401 | 403; debug?: BearerDebug };

/** Case-insensitive Authorization header lookup. */
function getAuthHeader(request: NextRequest): string | null {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  return h != null && h.length > 0 ? h : null;
}

/**
 * Extract and normalize Bearer token. Accepts "Bearer <jwt>" (case-insensitive).
 * Trims whitespace, strips surrounding double-quotes. Returns null if missing or not JWT-shaped (exactly 2 dots).
 */
function extractBearerToken(request: NextRequest): {
  token: string | null;
  debug: { hasAuthHeader: boolean; authHeaderPrefix: string; tokenLooksLikeJwt: boolean; tokenLen: number };
} {
  const authHeader = getAuthHeader(request);
  const hasAuthHeader = authHeader != null;
  const authHeaderPrefix = authHeader != null && /^Bearer\s+/i.test(authHeader)
    ? authHeader.slice(0, 7)
    : hasAuthHeader
      ? (authHeader!.split(/\s/)[0] ?? "")
      : "";
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return {
      token: null,
      debug: { hasAuthHeader, authHeaderPrefix, tokenLooksLikeJwt: false, tokenLen: 0 },
    };
  }
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1).trim();
  }
  const parts = token.split(".");
  const tokenLooksLikeJwt = parts.length === 3;
  return {
    token: token.length > 0 && tokenLooksLikeJwt ? token : null,
    debug: { hasAuthHeader, authHeaderPrefix, tokenLooksLikeJwt, tokenLen: token.length },
  };
}

/** Validate token via (A) anon client + getUser() and (B) getUser(token). Returns first success or both errors for debug. */
async function validateBearer(token: string): Promise<{
  user: User | null;
  supabase: SupabaseClient;
  methodAError: string | null;
  methodBError: string | null;
}> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase not configured");
  }
  const supabase: SupabaseClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  let methodAError: string | null = null;
  let methodBError: string | null = null;

  const { data: dataA, error: errorA } = await supabase.auth.getUser();
  if (!errorA && dataA?.user) {
    return { user: dataA.user, supabase, methodAError: null, methodBError: null };
  }
  methodAError = errorA?.message ?? (dataA?.user ? null : "no user") ?? "unknown";

  const { data: dataB, error: errorB } = await supabase.auth.getUser(token);
  if (!errorB && dataB?.user) {
    return { user: dataB.user, supabase, methodAError, methodBError: null };
  }
  methodBError = errorB?.message ?? (dataB?.user ? null : "no user") ?? "unknown";

  return { user: null, supabase, methodAError, methodBError };
}

async function loadProfileAndRole(
  supabase: SupabaseClient,
  userId: string
): Promise<
  { orgId: string; siteId: string | null; role: string } | { error: string; status: 401 | 403 }
> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_org_id, active_site_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found for user", status: 403 };
  }

  const orgId = profile.active_org_id ?? undefined;
  if (!orgId) {
    return { error: "No active organization", status: 403 };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const role = (membership?.role as string) ?? "";
  const allowed = role === "admin" || role === "hr";
  if (membershipError || !allowed) {
    return { error: "Admin or HR access required", status: 403 };
  }

  return {
    orgId,
    siteId: (profile.active_site_id as string | null) ?? null,
    role,
  };
}

/**
 * Resolve authenticated admin/HR context from request.
 * 1) Cookie-based: createServerClient(request) -> getUser()
 * 2) Else Bearer: Authorization: Bearer <token> -> getUser(token)
 * Then load profile + membership; require admin or hr role.
 * Returns 401 if neither cookie session nor Bearer token is valid.
 */
export async function getAuthedContext(request: NextRequest): Promise<AuthedContext> {
  // (A) Cookie-based SSR client (route handler: use request cookies)
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const loaded = await loadProfileAndRole(supabase, data.user.id);
      if ("error" in loaded) {
        return { ok: false, error: loaded.error, status: loaded.status };
      }
      return {
        ok: true,
        user: data.user,
        orgId: loaded.orgId,
        siteId: loaded.siteId,
        role: loaded.role,
        pendingCookies,
      };
    }
  } catch (e) {
    console.warn("[getAuthedContext] cookie path failed", e);
  }

  // (B) Bearer token
  const { token, debug: parseDebug } = extractBearerToken(request);
  if (token) {
    try {
      const { user, supabase, methodAError, methodBError } = await validateBearer(token);
      if (user) {
        const loaded = await loadProfileAndRole(supabase, user.id);
        if ("error" in loaded) {
          return { ok: false, error: loaded.error, status: loaded.status };
        }
        return {
          ok: true,
          user,
          orgId: loaded.orgId,
          siteId: loaded.siteId,
          role: loaded.role,
          pendingCookies: [],
        };
      }
      const debug: BearerDebug = {
        ...parseDebug,
        methodAError,
        methodBError,
      };
      return {
        ok: false,
        error: "Bearer invalid",
        status: 401,
        ...(process.env.NODE_ENV !== "production" && { debug }),
      };
    } catch (e) {
      console.warn("[getAuthedContext] bearer path failed", e);
      const debug: BearerDebug = {
        ...parseDebug,
        methodAError: e instanceof Error ? e.message : String(e),
        methodBError: null,
      };
      return {
        ok: false,
        error: "Bearer invalid",
        status: 401,
        ...(process.env.NODE_ENV !== "production" && { debug }),
      };
    }
  }

  if (parseDebug.hasAuthHeader && process.env.NODE_ENV !== "production") {
    return {
      ok: false,
      error: "Bearer invalid",
      status: 401,
      debug: {
        ...parseDebug,
        methodAError: null,
        methodBError: null,
      },
    };
  }

  return {
    ok: false,
    error: "Missing or invalid authentication (cookie session or Bearer token)",
    status: 401,
  };
}
