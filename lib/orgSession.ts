import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestId } from "@/lib/server/requestId";

export type OrgSessionResult = {
  success: true;
  userId: string;
  orgId: string;
  role: string;
} | {
  success: false;
  error: string;
  status: 400 | 401 | 403;
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
  const requestId = getRequestId(request);
  try {
    console.log(`[${requestId}] orgSession STEP 1 enter`);
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: false, error: "Supabase not configured", status: 401 };
    }

    const authHeader = request.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    let supabase: SupabaseClient;

    console.log(`[${requestId}] orgSession STEP 2 before cookies()`);
    const cookieStore = await cookies();
    console.log(`[${requestId}] orgSession STEP 3 cookies ok`);

    const cookieHeader = request.headers.get("cookie") || "";
    const len = cookieHeader.length;
    const hasPercent = cookieHeader.includes("%");
    const hasNonAscii = /[^\x20-\x7E]/.test(cookieHeader);
    console.log(`[${requestId}] orgSession STEP 4 cookieHeader stats`, { len, hasPercent, hasNonAscii });

    if (supabaseInstance) {
      supabase = supabaseInstance;
    } else {
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

    // Get user from session (handles both cookie-based and token-based auth)
    let user: { id: string } | undefined;
    let authError: { name?: string } | null = null;

    console.log(`[${requestId}] orgSession STEP 5 before getUser`);
    try {
      if (accessToken) {
        const result = await supabase.auth.getUser(accessToken);
        user = result.data.user ?? undefined;
        authError = result.error;
      } else {
        const result = await supabase.auth.getUser();
        user = result.data.user ?? undefined;
        authError = result.error;
      }
    } catch (err: unknown) {
      const errName =
        err && typeof err === "object" && "name" in err ? (err as { name?: unknown }).name : undefined;
      const errMessage =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : String(err);
      console.error(`[${requestId}] orgSession GETUSER THREW`, { name: errName, message: errMessage });
      return { success: false, error: "Invalid or expired session", status: 401 };
    }
    console.log(`[${requestId}] orgSession STEP 6 getUser done`, {
      hasUser: !!user,
      errorName: authError?.name ?? null,
    });

    if (authError || !user) {
      return { success: false, error: "Invalid or expired session", status: 401 };
    }

    const userId = user.id;

    const preferredOrgId =
      cookieStore.get("current_org_id")?.value ||
      cookieStore.get("nadiplan_current_org")?.value;

    console.log(`[${requestId}] orgSession STEP 7 before profile/membership`);
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

    const orgId = memberships[0].org_id;
    const role = memberships[0].role;
    console.log(`[${requestId}] orgSession STEP 8 success`, { orgId, role });
    return {
      success: true,
      userId,
      orgId,
      role,
    };
  } catch (err: unknown) {
    const errName =
      err && typeof err === "object" && "name" in err ? (err as { name?: unknown }).name : undefined;
    const errMessage =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);
    console.error(`[${requestId}] orgSession FAILED`, { name: errName, message: errMessage });
    const status: 400 | 401 = /cookie|cookies/i.test(errMessage) ? 400 : 401;
    return { success: false, error: "Invalid or expired session", status };
  }
}

export function isAdminOrHr(role: string): boolean {
  return role === "admin" || role === "hr";
}
