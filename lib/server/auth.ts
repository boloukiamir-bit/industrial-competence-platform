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
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) return null;
  if (!/^Bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
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
