/**
 * Canonical tenant resolution for server routes: always use session active_org_id.
 * Use this in all API routes instead of reading profile inline or using query params.
 * Cockpit never runs with site_id=null when org has sites: resolves first site and persists.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";

export type ActiveOrgResult =
  | { ok: true; activeOrgId: string; activeSiteId: string | null; userId: string }
  | { ok: false; error: string; status: 400 | 401 | 403 };

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Resolve active org from session (profile.active_org_id). Use in API routes.
 * Also returns active_site_id for tenant-scoped employee counts (e.g. Org Overview).
 * When active_site_id is null and org has sites: select first site (created_at asc), persist to profiles.
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

  let activeSiteId = (profile.active_site_id as string | null) ?? null;
  if (activeSiteId == null) {
    let defaultSite: { id: string } | null = null;
    const { data: siteFromAuth } = await authSupabase
      .from("sites")
      .select("id")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (siteFromAuth?.id) {
      defaultSite = { id: siteFromAuth.id as string };
    } else if (process.env.NODE_ENV !== "production") {
      const admin = getAdminClient();
      if (admin) {
        const { data: siteFromAdmin } = await admin
          .from("sites")
          .select("id")
          .eq("org_id", activeOrgId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (siteFromAdmin?.id) defaultSite = { id: siteFromAdmin.id as string };
      }
    }
    if (defaultSite?.id) {
      activeSiteId = defaultSite.id;
      await authSupabase
        .from("profiles")
        .update({ active_site_id: activeSiteId })
        .eq("id", user.id);
    }
  }

  return {
    ok: true,
    activeOrgId,
    activeSiteId,
    userId: user.id,
  };
}
