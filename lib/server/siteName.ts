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
  const { data: unit } = await supabase
    .from("org_units")
    .select("name")
    .eq("id", siteId)
    .limit(1)
    .maybeSingle();

  if (unit?.name) return unit.name;

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[getActiveSiteName] site not found in org_units — chip will show Unknown site",
      { org_id: orgId ?? null, site_id: siteId }
    );
  }
  return null;
}
