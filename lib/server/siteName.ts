/**
 * Resolve site UUID to display name for P0.8.2 site context chip.
 * profiles.active_site_id stores sites.id. Lookup by sites (id + org_id).
 * Single-site fallback: if exactly one site exists for org, return its name.
 * P0.8.2.1: return null if not found; caller shows "Unknown site". Dev-only warn.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveSiteName(
  supabase: SupabaseClient,
  siteId: string,
  orgId?: string
): Promise<string | null> {
  if (orgId == null) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getActiveSiteName] orgId required for tenant scope", { site_id: siteId });
    }
    return null;
  }

  let siteRow: { name?: string } | null = null;
  try {
    const { data } = await supabase
      .from("sites")
      .select("name")
      .eq("id", siteId)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    siteRow = data;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getActiveSiteName] sites query failed (table may not exist)", {
        org_id: orgId,
        site_id: siteId,
        error: e,
      });
    }
    return null;
  }

  if (siteRow?.name) return siteRow.name;

  // Single-site fallback: if org has exactly one site, return that site's name
  let siteCount: number | null = null;
  try {
    const { data: sites } = await supabase
      .from("sites")
      .select("name")
      .eq("org_id", orgId);
    siteCount = sites?.length ?? 0;
    if (siteCount === 1 && sites?.[0]?.name) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getActiveSiteName] primary miss, single site fallback used", {
          org_id: orgId,
          site_id: siteId,
          site_count: siteCount,
        });
      }
      return sites[0].name;
    }
  } catch {
    siteCount = null;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[getActiveSiteName] site not found — chip will show Unknown site", {
      org_id: orgId,
      site_id: siteId,
      site_count: siteCount ?? null,
    });
  }
  return null;
}
