import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient, type CookieToSet } from "@/lib/supabase/server";

export type ResolvedAuth =
  | {
      ok: true;
      user: User;
      supabase: SupabaseClient;
      pendingCookies: CookieToSet[];
      authType: "bearer" | "cookie";
    }
  | { ok: false; error: string; status: 401 };

function isProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    (process.env.VERCEL_ENV as string) === "production"
  );
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) return null;
  if (!/^Bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
}

/**
 * DEV only. If request has Authorization: Bearer <DEV_BEARER_TOKEN> and we're not in production,
 * resolve user from profiles by email and return synthetic auth. Used for local curl.
 */
async function tryDevBearer(request: NextRequest): Promise<ResolvedAuth | null> {
  if (isProduction()) return null;

  const token = extractBearerToken(request);
  const devToken = process.env.DEV_BEARER_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth] bearerAccepted: false, reason: no Authorization header");
    }
    return null;
  }
  if (!devToken || token !== devToken) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[auth] bearerAccepted: false, reason:",
        devToken ? "token mismatch" : "DEV_BEARER_TOKEN not set"
      );
    }
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth] bearerAccepted: true, reason: dev bearer; error: Supabase not configured");
    }
    return { ok: false, error: "Supabase not configured", status: 401 };
  }

  const supabase = createClient(url, key);
  const devEmail = (process.env.DEV_USER_EMAIL ?? "amir@bolouki.se").trim();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, active_org_id, active_site_id")
    .eq("email", devEmail)
    .maybeSingle();

  if (profileError || !profile) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth] bearerAccepted: true, reason: dev bearer; error: no profile for email");
    }
    return {
      ok: false,
      error: `Dev bearer: no profile found for email "${devEmail}". Ensure the user exists in Supabase Auth and has a row in public.profiles.`,
      status: 401,
    };
  }

  const syntheticUser = {
    id: profile.id,
    email: profile.email ?? devEmail,
    aud: "authenticated",
    role: "authenticated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  } as User;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[auth] bearerAccepted: true, reason: dev bearer", {
      email: syntheticUser.email,
      userId: syntheticUser.id,
    });
  }

  return {
    ok: true,
    user: syntheticUser,
    supabase,
    pendingCookies: [],
    authType: "bearer",
  };
}

async function validateBearer(token: string): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, supabase };
  }

  return { user: data.user, supabase };
}

export async function resolveAuthFromRequest(
  request: NextRequest,
  options?: { supabase?: SupabaseClient; pendingCookies?: CookieToSet[] }
): Promise<ResolvedAuth> {
  const devAuth = await tryDevBearer(request);
  if (devAuth !== null) return devAuth;

  const token = extractBearerToken(request);
  if (token) {
    try {
      const { user, supabase } = await validateBearer(token);
      if (user) {
        return {
          ok: true,
          user,
          supabase,
          pendingCookies: [],
          authType: "bearer",
        };
      }
    } catch {
      return { ok: false, error: "Supabase not configured", status: 401 };
    }
  }

  if (options?.supabase) {
    const { data, error } = await options.supabase.auth.getUser();
    if (error || !data.user) {
      return { ok: false, error: "Invalid or expired session", status: 401 };
    }

    return {
      ok: true,
      user: data.user,
      supabase: options.supabase,
      pendingCookies: options.pendingCookies ?? [],
      authType: "cookie",
    };
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: "Invalid or expired session", status: 401 };
  }

  return { ok: true, user: data.user, supabase, pendingCookies, authType: "cookie" };
}
