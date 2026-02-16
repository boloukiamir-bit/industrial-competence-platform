/**
 * Cockpit: only use seeded shifts (shift_patterns). Legacy Day/Evening/Night and free-text line are ignored.
 * Shared helper for shift IDs and allowed shift_codes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** (site_id, shift_code) pairs that are allowed for cockpit (from active shift_patterns). */
export async function getSeededShiftCodesBySite(
  supabase: SupabaseClient,
  orgId: string,
  siteId: string | null
): Promise<Set<string>> {
  let query = supabase
    .from("shift_patterns")
    .select("shift_code")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (siteId) {
    query = query.eq("site_id", siteId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[cockpitShifts] shift_patterns query error:", error);
    return new Set();
  }
  const codes = new Set<string>();
  for (const r of data ?? []) {
    const c = (r as { shift_code?: string }).shift_code;
    if (typeof c === "string" && c.trim()) codes.add(c.trim());
  }
  return codes;
}

/** Allowed (site_id, shift_code) for org. Used to filter shifts. */
export async function getSeededSiteShiftPairs(
  supabase: SupabaseClient,
  orgId: string,
  siteId: string | null
): Promise<Set<string>> {
  let query = supabase
    .from("shift_patterns")
    .select("site_id, shift_code")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (siteId) {
    query = query.eq("site_id", siteId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[cockpitShifts] shift_patterns query error:", error);
    return new Set();
  }
  const pairs = new Set<string>();
  for (const r of (data ?? []) as Array<{ site_id: string | null; shift_code: string | null }>) {
    const sid = r.site_id ?? "";
    const code = (r.shift_code ?? "").trim();
    if (sid && code) pairs.add(`${sid}:${code}`);
  }
  return pairs;
}

/**
 * Returns shift IDs for cockpit: org_id, date, site_id/area_id/shift_code not null,
 * and (site_id, shift_code) in active shift_patterns.
 */
export async function getSeededShiftIds(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    date: string;
    siteId?: string | null;
    shiftCode?: string | null;
  }
): Promise<string[]> {
  const { orgId, date, siteId, shiftCode } = params;
  const allowedPairs = await getSeededSiteShiftPairs(supabase, orgId, siteId ?? null);
  if (allowedPairs.size === 0) return [];

  let query = supabase
    .from("shifts")
    .select("id, site_id, shift_code")
    .eq("org_id", orgId)
    .eq("shift_date", date)
    .not("site_id", "is", null)
    .not("area_id", "is", null)
    .not("shift_code", "is", null);
  if (siteId) query = query.eq("site_id", siteId);
  if (shiftCode && shiftCode !== "all") query = query.eq("shift_code", shiftCode);

  const { data, error } = await query;
  if (error) {
    console.error("[cockpitShifts] shifts query error:", error);
    return [];
  }
  const rows = (data ?? []) as Array<{ id: string; site_id: string | null; shift_code: string | null }>;
  const ids: string[] = [];
  for (const r of rows) {
    const sid = r.site_id ?? "";
    const code = (r.shift_code ?? "").trim();
    if (sid && code && allowedPairs.has(`${sid}:${code}`)) ids.push(r.id);
  }
  return ids;
}
