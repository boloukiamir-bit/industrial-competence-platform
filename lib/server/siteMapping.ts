/**
 * Map session active_site_id (profiles.active_site_id → public.sites.id) to org_units.id
 * for compliance digest storage/lookup. Digest data uses org_units; UI/session may use sites.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve org_unit id to use for digest storage and queries.
 * - If activeSiteId is null => null.
 * - If activeSiteId matches an org_unit (id + org_id) => return it (backwards compat).
 * - Else load site from public.sites by id + org_id; if none => null.
 * - Else find org_unit with same name (exactly one match) => return that id; 0 or >1 => null.
 */
export async function resolveOrgUnitIdForSessionSite(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  activeSiteId: string | null
): Promise<string | null> {
  if (activeSiteId == null) return null;

  const direct = await supabaseAdmin
    .from("org_units")
    .select("id")
    .eq("id", activeSiteId)
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  if (direct.data?.id) return direct.data.id as string;

  let siteRow: { data: { id?: string; name?: string } | null; error: unknown };
  try {
    siteRow = await supabaseAdmin
      .from("sites")
      .select("id, name")
      .eq("id", activeSiteId)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[resolveOrgUnitIdForSessionSite] sites query failed (table may not exist)", {
        orgId,
        activeSiteId,
        error: e,
      });
    }
    return null;
  }
  if (siteRow.error || !siteRow.data?.name) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[resolveOrgUnitIdForSessionSite] no site row", {
        orgId,
        activeSiteId,
        siteName: siteRow.data?.name ?? null,
        matchCount: 0,
      });
    }
    return null;
  }
  const siteName = siteRow.data.name as string;

  const units = await supabaseAdmin
    .from("org_units")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("name", siteName)
    .limit(2);
  const list = units.data ?? [];
  if (list.length !== 1) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[resolveOrgUnitIdForSessionSite] name match not unique", {
        orgId,
        activeSiteId,
        siteName,
        matchCount: list.length,
      });
    }
    return null;
  }
  return list[0].id as string;
}
