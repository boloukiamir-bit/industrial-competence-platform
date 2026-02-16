/**
 * Get roster employee UUIDs for a station/shift (for compliance aggregation).
 * Uses same view and shift logic as cockpit drilldown. Tenant-safe: org_id + site_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const SHIFT_ALIASES: Record<string, string[]> = {
  Day: ["Day", "1"],
  Evening: ["Evening", "2", "EM"],
  Night: ["Night", "FM", "3"],
};

function getAcceptedShiftCodes(shiftCode: string): string[] {
  const normalized = shiftCode.trim();
  return SHIFT_ALIASES[normalized] ?? [normalized];
}

/**
 * Returns employee UUIDs for the roster at (org, site, station, shift).
 * Used by summary to compute total compliance risk across open issues.
 */
export async function getRosterEmployeeIdsForStationShift(
  supabase: SupabaseClient,
  orgId: string,
  siteId: string | null,
  stationId: string,
  shiftCode: string
): Promise<string[]> {
  const acceptedShiftCodes = getAcceptedShiftCodes(shiftCode);
  let query = supabase
    .from("v_roster_station_shift_drilldown_pilot")
    .select("employee_anst_id")
    .eq("org_id", orgId)
    .eq("station_id", stationId)
    .in("shift_code", acceptedShiftCodes)
    .limit(500);
  if (siteId) {
    query = query.or(`site_id.eq.${siteId},site_id.is.null`);
  } else {
    query = query.is("site_id", null);
  }
  const { data: pilotRows, error: pilotErr } = await query;
  if (pilotErr) throw new Error(`roster: ${pilotErr.message}`);
  const anstIds = [...new Set((pilotRows ?? []).map((r) => (r as { employee_anst_id: string }).employee_anst_id))];
  if (anstIds.length === 0) return [];
  const { data: emps, error: empErr } = await supabase
    .from("employees")
    .select("id")
    .eq("org_id", orgId)
    .in("employee_number", anstIds);
  if (empErr) throw new Error(`employees: ${empErr.message}`);
  return (emps ?? []).map((e) => (e as { id: string }).id).filter(Boolean);
}
