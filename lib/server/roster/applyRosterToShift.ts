/**
 * Deterministic, audit-proof roster application for a shift.
 * Populates shift_assignments.employee_id from stg_roster_v1 by mapping:
 * - roster.anst_id -> employees.id via employees.employee_number
 * - roster.station_code -> stations.id via stations.code
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeShiftCode } from "@/lib/server/normalizeShiftCode";

export type ApplyRosterToShiftParams = {
  supabaseAdmin: SupabaseClient;
  org_id: string;
  site_id: string | null;
  shift_id: string;
  shift_code: string;
  dry_run?: boolean;
};

export type ApplyRosterToShiftResult = {
  total_roster_rows: number;
  matched_pairs: number;
  updated_rows: number;
  missing_station_count: number;
  missing_employee_count: number;
  missing_station_codes_sample: string[];
  missing_anst_ids_sample: string[];
};

type RosterRow = { anst_id: string; station_code: string };
type DesiredPair = { station_id: string; employee_id: string };

const MAX_SAMPLE = 10;

export async function applyRosterToShift(
  params: ApplyRosterToShiftParams
): Promise<ApplyRosterToShiftResult> {
  const { supabaseAdmin, org_id, site_id, shift_id, shift_code, dry_run = false } = params;
  const normalizedShiftCode = normalizeShiftCode(shift_code);

  const result: ApplyRosterToShiftResult = {
    total_roster_rows: 0,
    matched_pairs: 0,
    updated_rows: 0,
    missing_station_count: 0,
    missing_employee_count: 0,
    missing_station_codes_sample: [],
    missing_anst_ids_sample: [],
  };

  // 1) Fetch roster rows from stg_roster_v1
  const { data: rosterRows, error: rosterError } = await supabaseAdmin
    .from("stg_roster_v1")
    .select("anst_id, station_code")
    .eq("shift_code", normalizedShiftCode);

  if (rosterError) {
    console.error("[applyRosterToShift] stg_roster_v1 error:", rosterError);
    return result;
  }

  const rawRoster = (rosterRows ?? []) as RosterRow[];
  result.total_roster_rows = rawRoster.length;
  if (rawRoster.length === 0) return result;

  // 2) Stations map: code -> id for org_id
  const { data: stationRows, error: stationError } = await supabaseAdmin
    .from("stations")
    .select("id, code")
    .eq("org_id", org_id)
    .eq("is_active", true);

  if (stationError) {
    console.error("[applyRosterToShift] stations error:", stationError);
    return result;
  }

  const stationsByCode = new Map<string, string>();
  for (const row of stationRows ?? []) {
    const r = row as { id: string; code: string | null };
    if (r.code != null && r.code.trim() !== "") stationsByCode.set(r.code.trim(), r.id);
  }

  // 3) Employees map: employee_number -> id for org_id (+ site scope)
  let empQuery = supabaseAdmin
    .from("employees")
    .select("id, employee_number")
    .eq("org_id", org_id);
  if (site_id) {
    empQuery = empQuery.or(`site_id.is.null,site_id.eq.${site_id}`);
  }
  const { data: employeeRows, error: employeeError } = await empQuery;

  if (employeeError) {
    console.error("[applyRosterToShift] employees error:", employeeError);
    return result;
  }

  const employeesByNumber = new Map<string, string>();
  for (const row of employeeRows ?? []) {
    const r = row as { id: string; employee_number: string | null };
    if (r.employee_number != null && String(r.employee_number).trim() !== "") {
      employeesByNumber.set(String(r.employee_number).trim(), r.id);
    }
  }

  // 4) Build desired pairs; one per station (deterministic: first anst_id per station_code by anst_id order)
  const rosterSorted = [...rawRoster].sort((a, b) => {
    const sc = (a.station_code ?? "").localeCompare(b.station_code ?? "");
    if (sc !== 0) return sc;
    return (a.anst_id ?? "").localeCompare(b.anst_id ?? "");
  });

  const missingStationCodes = new Set<string>();
  const missingAnstIds = new Set<string>();
  const pairsByStation = new Map<string, DesiredPair>();

  for (const row of rosterSorted) {
    const stationCode = (row.station_code ?? "").trim();
    const anstId = (row.anst_id ?? "").trim();
    const stationId = stationCode ? stationsByCode.get(stationCode) ?? null : null;
    const employeeId = anstId ? employeesByNumber.get(anstId) ?? null : null;

    if (stationCode && !stationId) missingStationCodes.add(stationCode);
    if (anstId && !employeeId) missingAnstIds.add(anstId);

    if (stationId && employeeId && !pairsByStation.has(stationId)) {
      pairsByStation.set(stationId, { station_id: stationId, employee_id: employeeId });
    }
  }

  result.matched_pairs = pairsByStation.size;
  result.missing_station_count = missingStationCodes.size;
  result.missing_employee_count = missingAnstIds.size;
  result.missing_station_codes_sample = [...missingStationCodes].sort().slice(0, MAX_SAMPLE);
  result.missing_anst_ids_sample = [...missingAnstIds].sort().slice(0, MAX_SAMPLE);

  if (dry_run) return result;

  // 5) Update shift_assignments: set employee_id where shift_id + station_id match (deterministic order)
  const desiredList = [...pairsByStation.values()].sort((a, b) =>
    a.station_id.localeCompare(b.station_id)
  );

  let updated = 0;
  const CHUNK = 50;
  for (let i = 0; i < desiredList.length; i += CHUNK) {
    const chunk = desiredList.slice(i, i + CHUNK);
    for (const { station_id, employee_id } of chunk) {
      const { error: updateError } = await supabaseAdmin
        .from("shift_assignments")
        .update({ employee_id })
        .eq("shift_id", shift_id)
        .eq("station_id", station_id)
        .eq("org_id", org_id);

      if (!updateError) updated += 1;
      else console.error("[applyRosterToShift] update error for station", station_id, updateError);
    }
  }

  result.updated_rows = updated;
  return result;
}
