/**
 * Require active org from session and admin or hr role. Use in admin API routes.
 * Resolves user via supabase.auth.getUser() (Bearer or cookies); uses the same
 * auth-bound client for profile and memberships so Bearer tokens work.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";

export type AdminOrHrResult =
  | {
      ok: true;
      activeOrgId: string;
      activeSiteId: string | null;
      userId: string;
      role: string;
      /** Set only in dev; set as response header x-auth-debug for diagnosis */
      debugHeader?: string;
    }
  | { ok: false; error: string; status: 400 | 401 | 403; debugHeader?: string };

export async function requireAdminOrHr(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<AdminOrHrResult> {
  const resolved = await resolveAuthFromRequest(request, { supabase });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: resolved.status };
  }

  const { supabase: authSupabase, user } = resolved;

  const { data: profile, error: profileError } = await authSupabase
    .from("profiles")
    .select("active_org_id, active_site_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, error: "Profile not found for user", status: 403 };
  }

  const activeOrgId = profile.active_org_id ?? undefined;
  if (!activeOrgId) {
    return { ok: false, error: "No active organization", status: 403 };
  }

  const { data: membership, error: membershipError } = await authSupabase
    .from("memberships")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const role = (membership?.role as string) ?? "";
  const allowed = role === "admin" || role === "hr";
  if (membershipError || !allowed) {
    const debugHeader =
      process.env.NODE_ENV !== "production"
        ? `user=${user.id};org=${activeOrgId};role=${role || "none"}`
        : undefined;
    return {
      ok: false,
      error: "Admin or HR access required",
      status: 403,
      ...(debugHeader ? { debugHeader } : {}),
    };
  }

  const debugHeader =
    process.env.NODE_ENV !== "production"
      ? `user=${user.id};org=${activeOrgId};role=${role}`
      : undefined;

  return {
    ok: true,
    activeOrgId,
    activeSiteId: (profile.active_site_id as string | null) ?? null,
    userId: user.id,
    role,
    ...(debugHeader ? { debugHeader } : {}),
  };
}
