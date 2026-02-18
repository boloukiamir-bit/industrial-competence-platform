/**
 * Auth bootstrap for Next.js App Router route handlers.
 * Uses resolveAuthFromRequest (lib/server/auth) as single source of truth: dev bearer, then Bearer JWT, then cookie.
 * Loads profile (active_org_id, active_site_id) and membership role; enforces admin or hr.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";
import type { CookieToSet } from "@/lib/supabase/server";

/** Debug info for Bearer 401 (non-production only). Kept for type compatibility. */
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
 * Uses resolveAuthFromRequest (single source of truth: dev bearer, Bearer JWT, cookie).
 * Then load profile + membership; require admin or hr role.
 * Returns 401 with standardized error shape: { ok: false, error: "Invalid or expired session" }.
 */
export async function getAuthedContext(
  request: NextRequest,
  options?: { routeLabel?: string }
): Promise<AuthedContext> {
  const routeLabel = options?.routeLabel ?? "auth";
  const resolved = await resolveAuthFromRequest(request);
  if (!resolved.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth]", routeLabel, "authMode=n/a", "accepted=false", "reason:", resolved.error);
    }
    return {
      ok: false,
      error: "Invalid or expired session",
      status: 401,
    };
  }
  const loaded = await loadProfileAndRole(resolved.supabase, resolved.user.id);
  if ("error" in loaded) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[auth]", routeLabel, "authMode=" + resolved.authType, "accepted=false", "reason:", loaded.error);
    }
    return { ok: false, error: loaded.error, status: loaded.status };
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[auth]", routeLabel, "authMode=" + resolved.authType, "accepted=true");
  }
  return {
    ok: true,
    user: resolved.user,
    orgId: loaded.orgId,
    siteId: loaded.siteId,
    role: loaded.role,
    pendingCookies: resolved.pendingCookies,
  };
}
