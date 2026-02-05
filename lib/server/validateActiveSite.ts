/**
 * Validate that a site id belongs to the given org (sites.id + sites.org_id).
 * profiles.active_site_id stores sites.id. Returns the siteId if valid, null otherwise.
 * Allow NULL input → return null.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function validateActiveSiteIdForOrg(
  supabase: SupabaseClient,
  siteId: string | null | undefined,
  orgId: string
): Promise<string | null> {
  if (siteId == null || siteId === "") return null;
  let data: { id?: string } | null = null;
  try {
    const res = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    data = res.data;
  } catch {
    return null;
  }
  return data?.id ?? null;
}

/**
 * If activeSiteId is set but activeSiteName is null, clear profile.active_site_id and return (null, null).
 * Otherwise return (activeSiteId, activeSiteName). Server-side only; logs when normalization runs.
 */
export async function normalizeProfileActiveSiteIfStale(
  supabase: SupabaseClient,
  userId: string,
  activeSiteId: string | null,
  activeSiteName: string | null
): Promise<{ activeSiteId: string | null; activeSiteName: string | null }> {
  if (activeSiteId == null || activeSiteName != null) {
    return { activeSiteId, activeSiteName };
  }
  const { error } = await supabase.from("profiles").update({ active_site_id: null }).eq("id", userId);
  if (error) {
    console.error("[normalizeProfileActiveSiteIfStale] profile update failed", { userId, activeSiteId, error: error.message });
    return { activeSiteId, activeSiteName };
  }
  console.info("[normalizeProfileActiveSiteIfStale] cleared stale active_site_id", { userId, previous_site_id: activeSiteId });
  return { activeSiteId: null, activeSiteName: null };
}
