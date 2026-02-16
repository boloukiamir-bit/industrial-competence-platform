/**
 * Server-only roster helpers shared across Cockpit and Compliance.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRosterEmployeeIdsForStationShift } from "@/lib/server/getRosterEmployeeIdsForStationShift";

type RosterLookupParams = {
  orgId: string;
  siteId: string | null;
  stationId: string;
  shiftCode?: string | null;
  date?: string | null;
};

const MAX_ROSTER_ROWS = 1000;

/**
 * Get roster employee UUIDs for station/shift/date. Uses Cockpit helper when possible.
 * If shiftCode is "all" or missing, no shift filtering is applied (still station scoped).
 */
export async function getRosterEmployeeIdsForStationShiftServer(
  supabase: SupabaseClient,
  params: RosterLookupParams
): Promise<string[]> {
  const normalizedShift = params.shiftCode?.trim();
  const shiftIsAll = !normalizedShift || normalizedShift.toLowerCase() === "all";
  if (!shiftIsAll && normalizedShift) {
    return getRosterEmployeeIdsForStationShift(
      supabase,
      params.orgId,
      params.siteId,
      params.stationId,
      normalizedShift
    );
  }

  let query = supabase
    .from("v_roster_station_shift_drilldown_pilot")
    .select("employee_anst_id")
    .eq("org_id", params.orgId)
    .eq("station_id", params.stationId)
    .limit(MAX_ROSTER_ROWS);
  if (params.date) {
    query = query.eq("plan_date", params.date);
  }
  if (params.siteId) {
    query = query.or(`site_id.eq.${params.siteId},site_id.is.null`);
  } else {
    query = query.is("site_id", null);
  }
  const { data: pilotRows, error: pilotErr } = await query;
  if (pilotErr) throw new Error(`roster: ${pilotErr.message}`);

  const anstIds = [
    ...new Set(
      (pilotRows ?? []).map((r) => (r as { employee_anst_id: string }).employee_anst_id)
    ),
  ];
  if (anstIds.length === 0) return [];

  const { data: emps, error: empErr } = await supabase
    .from("employees")
    .select("id")
    .eq("org_id", params.orgId)
    .in("employee_number", anstIds);
  if (empErr) throw new Error(`employees: ${empErr.message}`);
  return (emps ?? []).map((e) => (e as { id: string }).id).filter(Boolean);
}
