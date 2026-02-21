/**
 * Canonical tenant resolution for server routes: always use session active_org_id.
 * Use this in all API routes instead of reading profile inline or using query params.
 * Auto-bootstraps active_org_id and active_site_id from memberships/sites when missing (deterministic, tenant-safe).
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";

export type ActiveOrgResult =
  | { ok: true; activeOrgId: string; activeSiteId: string | null; userId: string; bootstrapped?: boolean }
  | { ok: false; error: string; status: 400 | 401 | 403 };

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Resolve active org from session (profile.active_org_id). Use in API routes.
 * When profile has null active_org_id or user is not a member of that org: bootstrap from first valid membership.
 * When active_site_id is null or site not in active_org: bootstrap first site for that org.
 * Returns 403 if profile is missing or no valid membership after bootstrap.
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
  let bootstrapped = false;

  // Load profile once
  const { data: profile, error: profileError } = await authSupabase
    .from("profiles")
    .select("active_org_id, active_site_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, error: "Profile not found for user", status: 403 };
  }

  let activeOrgId = (profile.active_org_id as string | null) ?? null;
  let activeSiteId = (profile.active_site_id as string | null) ?? null;

  // Bootstrap active_org_id: must be from user's memberships only
  const { data: memberships, error: memError } = await authSupabase
    .from("memberships")
    .select("org_id, role, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (memError) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[activeOrg] memberships query error", memError.message);
    }
    return { ok: false, error: "Failed to resolve organization", status: 403 };
  }

  const list = (memberships ?? []) as { org_id: string; role: string | null; created_at?: string }[];
  const hasValidOrg = activeOrgId && list.some((m) => m.org_id === activeOrgId);

  if (!activeOrgId || !hasValidOrg) {
    if (list.length === 0) {
      return { ok: false, error: "No active organization", status: 403 };
    }
    // Prefer admin role, else first by created_at
    const byAdmin = list.find((m) => (m.role ?? "").toLowerCase() === "admin");
    const chosen = byAdmin ?? list[0];
    activeOrgId = chosen.org_id;
    const { error: updateOrgErr } = await authSupabase
      .from("profiles")
      .update({ active_org_id: activeOrgId, active_site_id: null })
      .eq("id", user.id);
    if (updateOrgErr) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[activeOrg] bootstrap active_org_id update error", updateOrgErr.message);
      }
      return { ok: false, error: "Failed to set active organization", status: 403 };
    }
    activeSiteId = null;
    bootstrapped = true;
  }

  // Bootstrap active_site_id: must be a site belonging to active_org_id only
  let siteValid = false;
  if (activeSiteId) {
    const { data: siteRow } = await authSupabase
      .from("sites")
      .select("id")
      .eq("id", activeSiteId)
      .eq("org_id", activeOrgId)
      .maybeSingle();
    siteValid = !!siteRow?.id;
  }
  if (!activeSiteId || !siteValid) {
    const admin = getAdminClient();
    const sitesClient = admin ?? authSupabase;
    const { data: siteFromOrg } = await sitesClient
      .from("sites")
      .select("id")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (siteFromOrg?.id) {
      activeSiteId = siteFromOrg.id as string;
      const { error: updateSiteErr } = await authSupabase
        .from("profiles")
        .update({ active_site_id: activeSiteId })
        .eq("id", user.id);
      if (!updateSiteErr) bootstrapped = true;
      else if (process.env.NODE_ENV !== "production") {
        console.log("[activeOrg] bootstrap active_site_id update error", updateSiteErr.message);
      }
    }
  }

  return {
    ok: true,
    activeOrgId,
    activeSiteId,
    userId: user.id,
    bootstrapped,
  };
}
