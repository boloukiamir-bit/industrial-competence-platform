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

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
}

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

function devBearerMatches(token: string): boolean {
  const dev = process.env.DEV_BEARER_TOKEN ?? process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN ?? "";
  return dev !== "" && token === dev;
}

async function resolveDevBearer(token: string): Promise<ResolvedAuth | null> {
  if (isProduction || !devBearerMatches(token)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key);
  const devEmail =
    (process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "").trim() || "amir@bolouki.se";
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email, active_org_id, active_site_id")
    .eq("email", devEmail)
    .maybeSingle();
  if (error || !profile?.id) return null;
  const user = { id: profile.id, email: profile.email ?? devEmail } as User;
  return {
    ok: true,
    user,
    supabase: admin,
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
  const token = extractBearerToken(request);
  if (token) {
    const devAuth = await resolveDevBearer(token);
    if (devAuth) return devAuth;
    if (!isProduction) {
      return { ok: false, error: "Invalid or expired session", status: 401 };
    }
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
    return { ok: false, error: "Invalid or expired session", status: 401 };
  }

  return { ok: false, error: "Invalid or expired session", status: 401 };
}
