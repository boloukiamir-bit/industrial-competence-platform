/**
 * Resolve area_id by area name or code within a site. Used by onboarding stations.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AreaRow = { id: string; site_id: string; code: string; name: string };

export async function getAreasByOrgAndSites(
  supabase: SupabaseClient,
  orgId: string,
  siteIds: string[]
): Promise<AreaRow[]> {
  if (siteIds.length === 0) return [];
  const { data, error } = await supabase
    .from("areas")
    .select("id, site_id, code, name")
    .eq("org_id", orgId)
    .in("site_id", siteIds);
  if (error) {
    console.error("[onboarding] getAreasByOrgAndSites", { orgId, error: error.message });
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    site_id: r.site_id ?? "",
    code: (r.code ?? "").trim(),
    name: (r.name ?? "").trim(),
  }));
}

/** Key: siteId_nameOrCode (lowercase). Value: area row. */
export function buildAreaLookup(areas: AreaRow[]): Map<string, AreaRow> {
  const map = new Map<string, AreaRow>();
  for (const a of areas) {
    const keyByCode = `${a.site_id}_${a.code.toLowerCase()}`;
    const keyByName = `${a.site_id}_${a.name.toLowerCase()}`;
    map.set(keyByCode, a);
    if (keyByName !== keyByCode) map.set(keyByName, a);
  }
  return map;
}

export function resolveAreaId(
  siteId: string,
  areaNameOrCode: string,
  areaLookup: Map<string, AreaRow>
): { id: string; code: string } | null {
  const trimmed = (areaNameOrCode ?? "").trim().toLowerCase();
  if (!trimmed || !siteId) return null;
  const key = `${siteId}_${trimmed}`;
  const area = areaLookup.get(key);
  if (!area) return null;
  return { id: area.id, code: area.code };
}
