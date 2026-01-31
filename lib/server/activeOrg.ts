// placeholder
/**
 * Canonical tenant resolution for server routes: always use session active_org_id.
 * Use this in all API routes instead of reading profile inline or using query params.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";

export type ActiveOrgResult =
  | { ok: true; activeOrgId: string; activeSiteId: string | null; userId: string }
  | { ok: false; error: string; status: 400 | 401 | 403 };

/**
 * Resolve active org from session (profile.active_org_id). Use in API routes.
 * Also returns active_site_id for tenant-scoped employee counts (e.g. Org Overview).
 * Returns 403 if profile is missing or active_org_id is unset.
 */
export async function getActiveOrgFromSession(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<ActiveOrgResult> {
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

  return {
    ok: true,
    activeOrgId,
    activeSiteId: (profile.active_site_id as string | null) ?? null,
    userId: user.id,
  };
}
