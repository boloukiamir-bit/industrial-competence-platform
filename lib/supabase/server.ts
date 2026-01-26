import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Creates a Supabase client for use in App Router route handlers (app/api/**).
 * Reads auth from request cookies and collects any cookies Supabase wants to set
 * (e.g. on token refresh) into pendingCookies. The route must call
 * applySupabaseCookies(response, pendingCookies) before returning.
 */
export async function createSupabaseServerClient(): Promise<{
  supabase: ReturnType<typeof createServerClient>;
  pendingCookies: CookieToSet[];
}> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required");
  }

  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach((c) => pendingCookies.push(c));
      },
    },
  });

  return { supabase, pendingCookies };
}

/**
 * Applies cookies collected by createSupabaseServerClient's setAll to the
 * route response. Call this before returning NextResponse from a route handler.
 */
export function applySupabaseCookies(
  response: NextResponse,
  pendingCookies: CookieToSet[]
): void {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, (options as Record<string, unknown>) || {});
  });
}
