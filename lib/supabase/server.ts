import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/** Normalize malformed Supabase auth cookie values to prevent auth-js crashes. */
function normalizeSupabaseAuthCookie(name: string, value: string): string | null {
  // Only handle Supabase project auth cookie: sb-<projectRef>-auth-token
  if (!/^sb-[a-z0-9]+-auth-token$/i.test(name)) return value;

  let v = (value ?? "").trim();

  // Remove surrounding quotes if present
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }

  // Replace stray % not followed by 2 hex digits (do NOT decode)
  if (v.includes("%")) {
    v = v.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
  }

  // Fix common quoted-printable artifact and equivalent percent form (no decoding)
  if (v.includes("=3D") || v.includes("%3D") || v.includes("%3d")) {
    v = v.replace(/=3D/g, "=").replace(/%3D/gi, "=");
  }

  // If Supabase storage uses base64- prefix, ensure payload is base64url-safe
  if (v.startsWith("base64-")) {
    let payload = v.slice("base64-".length);

    // Convert standard base64 to base64url
    payload = payload.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    // Validate base64url charset only
    if (!/^[A-Za-z0-9\-_]+$/.test(payload)) {
      return null; // Drop cookie (treat as no session)
    }

    return `base64-${payload}`;
  }

  // Not base64- prefixed; return sanitized string as-is
  return v;
}

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

  // DEV-ONLY: Log cookie diagnostics
  if (process.env.NODE_ENV !== "production") {
    const cookieNames = cookieStore.getAll().map((c) => c.name);
    const projectRef = url?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "unknown";
    const projectAuthCookie = cookieStore.get(`sb-${projectRef}-auth-token`);
    console.log("[DEV createSupabaseServerClient] Cookie names from cookies():", cookieNames);
    console.log("[DEV createSupabaseServerClient] Project ref:", projectRef);
    console.log("[DEV createSupabaseServerClient] Project auth cookie exists:", !!projectAuthCookie);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const all = cookieStore.getAll();
        const out: { name: string; value: string }[] = [];

        for (const c of all) {
          if (/^sb-[a-z0-9]+-auth-token$/i.test(c.name)) {
            const normalized = normalizeSupabaseAuthCookie(c.name, c.value);

            if (normalized == null) {
              // Dev-only: log cookie name only
              if (process.env.NODE_ENV !== "production") {
                console.log("[DEV] dropped malformed auth cookie", { name: c.name });
              }
              continue; // OMIT the cookie
            }

            out.push({ name: c.name, value: normalized });
          } else {
            out.push({ name: c.name, value: c.value });
          }
        }

        return out;
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
