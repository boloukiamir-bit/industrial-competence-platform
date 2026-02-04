/**
 * Resolve site UUID to display name for P0.8.2 site context chip.
 * Only org_units — never fall back to organization name (chip must not lie).
 * P0.8.2.1: return null if not found; caller shows "Unknown site". Dev-only warn.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveSiteName(
  supabase: SupabaseClient,
  siteId: string,
  orgId?: string
): Promise<string | null> {
  // Primary: exact match by id and org_id (tenant-correct)
  let query = supabase.from("org_units").select("name").eq("id", siteId);
  if (orgId != null) {
    query = query.eq("org_id", orgId);
  }
  const { data: unit } = await query.limit(1).maybeSingle();

  if (unit?.name) return unit.name;

  // Fallback: when primary returns null and we have orgId, single-site orgs get the one unit's name
  let unitCount: number | null = null;
  if (orgId != null) {
    const { data: units } = await supabase
      .from("org_units")
      .select("name")
      .eq("org_id", orgId);

    unitCount = units?.length ?? 0;
    if (unitCount === 1 && units?.[0]?.name) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getActiveSiteName] primary miss, single org_unit fallback used", {
          org_id: orgId,
          site_id: siteId,
          unit_count: unitCount,
        });
      }
      return units[0].name;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[getActiveSiteName] site not found — chip will show Unknown site", {
      org_id: orgId ?? null,
      site_id: siteId,
      unit_count: unitCount ?? null,
    });
  }
  return null;
}
