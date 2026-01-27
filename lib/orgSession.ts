import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgSessionResult = {
  success: true;
  userId: string;
  orgId: string;
  role: string;
} | {
  success: false;
  error: string;
  status: 401 | 403;
};

/**
 * Resolve org and user from the session. When supabase is passed (from
 * createSupabaseServerClient), it uses cookie-based SSR auth and can write
 * refreshed tokens into pendingCookies. When omitted, creates a client with
 * read-only cookies (for backward compatibility with routes not yet using the
 * server helper).
 */
export async function getOrgIdFromSession(
  request: NextRequest,
  supabaseInstance?: SupabaseClient
): Promise<OrgSessionResult> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { success: false, error: "Supabase not configured", status: 401 };
  }

  const authHeader = request.headers.get("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  let supabase: SupabaseClient;

  if (supabaseInstance) {
    supabase = supabaseInstance;
  } else {
    const cookieStore = await cookies();
    supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op when not using createSupabaseServerClient; caller won't apply cookies
        },
      },
    });
  }

  const cookieStore = await cookies();

  // DEV-ONLY: Log cookie diagnostics
  if (process.env.NODE_ENV !== "production") {
    const cookieNames = cookieStore.getAll().map((c) => c.name);
    const projectRef = supabaseUrl?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "unknown";
    const projectAuthCookie = cookieStore.get(`sb-${projectRef}-auth-token`);
    const genericAuthCookie = cookieStore.get("sb-access-token") || cookieStore.get("sb-auth-token");
    console.log("[DEV getOrgIdFromSession] Cookie names:", cookieNames);
    console.log("[DEV getOrgIdFromSession] Project ref:", projectRef);
    console.log("[DEV getOrgIdFromSession] Project auth cookie exists:", !!projectAuthCookie);
    console.log("[DEV getOrgIdFromSession] Generic auth cookie exists:", !!genericAuthCookie);
    // Also check request cookies directly
    const requestCookieHeader = request.headers.get("cookie");
    console.log("[DEV getOrgIdFromSession] Request cookie header present:", !!requestCookieHeader);
    if (requestCookieHeader) {
      const hasProjectCookie = requestCookieHeader.includes(`sb-${projectRef}-auth-token`);
      console.log("[DEV getOrgIdFromSession] Request has project cookie:", hasProjectCookie);
    }
  }

  // Get user from session (handles both cookie-based and token-based auth)
  let user;
  let authError;

  if (accessToken) {
    // If token provided via header, use it directly
    const result = await supabase.auth.getUser(accessToken);
    user = result.data.user;
    authError = result.error;
  } else {
    // Otherwise, use cookie-based session (createServerClient handles this)
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  }

  // DEV-ONLY: Log auth result
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV getOrgIdFromSession] getUser result:", {
      hasUser: !!user,
      userId: user?.id || null,
      errorName: authError?.name || null,
    });
  }

  if (authError || !user) {
    return { success: false, error: "Invalid or expired session", status: 401 };
  }

  const userId = user.id;

  const preferredOrgId =
    cookieStore.get("current_org_id")?.value ||
    cookieStore.get("nadiplan_current_org")?.value;

  let membershipQuery = supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (preferredOrgId) {
    membershipQuery = membershipQuery.eq("org_id", preferredOrgId);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;

  if (membershipError) {
    return { success: false, error: "Failed to resolve organization", status: 403 };
  }

  if (!memberships || memberships.length === 0) {
    return { success: false, error: "No active organization membership", status: 403 };
  }

  return {
    success: true,
    userId,
    orgId: memberships[0].org_id,
    role: memberships[0].role,
  };
}

export function isAdminOrHr(role: string): boolean {
  return role === "admin" || role === "hr";
}
