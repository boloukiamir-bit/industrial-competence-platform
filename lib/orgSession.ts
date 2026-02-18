import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";

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
 * Resolve org and user from the session. Uses resolveAuthFromRequest (single source of truth:
 * dev bearer, Bearer JWT, cookie). When supabaseInstance is passed (from createSupabaseServerClient),
 * it is used for the cookie path; dev bearer and Bearer token still run first.
 */
export async function getOrgIdFromSession(
  request: NextRequest,
  supabaseInstance?: SupabaseClient
): Promise<OrgSessionResult> {
  try {
    const resolved = await resolveAuthFromRequest(
      request,
      supabaseInstance ? { supabase: supabaseInstance } : undefined
    );
    if (!resolved.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[auth] orgSession authMode=n/a accepted=false reason:", resolved.error);
      }
      return { success: false, error: "Invalid or expired session", status: 401 };
    }

    const userId = resolved.user.id;
    const cookieStore = await cookies();
    const preferredOrgId =
      cookieStore.get("current_org_id")?.value ||
      cookieStore.get("nadiplan_current_org")?.value;

    let membershipQuery = resolved.supabase
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

    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth] orgSession authMode=" + resolved.authType, "accepted=true");
    }
    return {
      success: true,
      userId,
      orgId: memberships[0].org_id,
      role: memberships[0].role,
    };
  } catch (err: unknown) {
    const errMessage =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth] orgSession accepted=false reason:", errMessage);
    }
    const status: 400 | 401 = /cookie|cookies/i.test(errMessage) ? 400 : 401;
    return { success: false, error: "Invalid or expired session", status };
  }
}

export function isAdminOrHr(role: string): boolean {
  return role === "admin" || role === "hr";
}
