/**
 * Resolve site_id by site_name within an org. Used by onboarding preview/apply.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSitesByOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("sites")
    .select("id, name")
    .eq("org_id", orgId);
  if (error) {
    console.error("[onboarding] getSitesByOrg", { orgId, error: error.message });
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, name: (r.name ?? "").trim() }));
}

/** Map: normalized site name -> site id. Names trimmed and lowercased for lookup. */
export function buildSiteNameToIdMap(
  sites: { id: string; name: string }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of sites) {
    const key = s.name.toLowerCase().trim();
    if (key) map.set(key, s.id);
  }
  return map;
}

export function resolveSiteId(
  siteName: string,
  siteNameToId: Map<string, string>
): string | null {
  const key = (siteName ?? "").trim().toLowerCase();
  if (!key) return null;
  return siteNameToId.get(key) ?? null;
}
