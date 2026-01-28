import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const SB_AUTH_COOKIE_RE = /^sb-[a-z0-9]+-auth-token$/i;

/** Returns true only if base64url payload decodes to valid UTF-8 (fatal decode). */
function isValidUtf8FromBase64Url(payload: string): boolean {
  let b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  try {
    const bytes = Buffer.from(b64, "base64");
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Normalize malformed Supabase auth cookie values to prevent auth-js crashes. */
function normalizeSupabaseAuthCookie(name: string, value: string): string | null {
  if (!SB_AUTH_COOKIE_RE.test(name)) return value;

  let v = (value ?? "").trim();

  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }

  if (v.includes("%")) {
    v = v.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
  }

  if (v.includes("=3D") || v.includes("%3D") || v.includes("%3d")) {
    v = v.replace(/=3D/g, "=").replace(/%3D/gi, "=");
  }

  if (v.startsWith("base64-")) {
    let payload = v.slice("base64-".length);
    payload = payload.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    if (!/^[A-Za-z0-9\-_]+$/.test(payload)) return null;
    if (!isValidUtf8FromBase64Url(payload)) return null;

    return `base64-${payload}`;
  }

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

  const makeOptions = (getAllFn: () => { name: string; value: string }[]) => ({
    cookies: {
      getAll: getAllFn,
      setAll(cookiesToSet: CookieToSet[]) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const getAllWithAuth = (): { name: string; value: string }[] => {
    const all = cookieStore.getAll();
    const out: { name: string; value: string }[] = [];
    for (const c of all) {
      if (SB_AUTH_COOKIE_RE.test(c.name)) {
        const normalized = normalizeSupabaseAuthCookie(c.name, c.value);
        if (normalized == null) {
          if (process.env.NODE_ENV !== "production") {
            console.log("[DEV] dropped malformed auth cookie", { name: c.name });
          }
          continue;
        }
        out.push({ name: c.name, value: normalized });
      } else {
        out.push({ name: c.name, value: c.value });
      }
    }
    return out;
  };

  const getAllWithoutAuth = (): { name: string; value: string }[] => {
    const all = cookieStore.getAll();
    const out: { name: string; value: string }[] = [];
    for (const c of all) {
      if (SB_AUTH_COOKIE_RE.test(c.name)) continue;
      out.push({ name: c.name, value: c.value });
    }
    return out;
  };

  let supabase: ReturnType<typeof createServerClient>;
  try {
    supabase = createServerClient(url, anonKey, makeOptions(getAllWithAuth));
  } catch {
    supabase = createServerClient(url, anonKey, makeOptions(getAllWithoutAuth));
  }

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
