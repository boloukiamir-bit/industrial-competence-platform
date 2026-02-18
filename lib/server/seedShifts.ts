/**
 * Shared deterministic shift seed: create shifts and shift_assignments for site/date/shift_code.
 * Optional line filter limits to a single area (code or name).
 * Used by POST /api/shifts/seed and POST /api/onboarding/bootstrap.
 * Caller must ensure org_id and site_id are tenant-scoped; this module does not enforce auth.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SeedShiftsSummary = {
  shifts_created: number;
  shifts_existing: number;
  assignments_created: number;
  assignments_existing: number;
  shifts_count: number;
  assignments_count: number;
};

export type SeedShiftsSuccess = {
  ok: true;
  areas_found: number;
  stations_found_total: number;
  summary: SeedShiftsSummary;
};

export type SeedShiftsValidationError = {
  ok: false;
  errorCode: "shift_pattern_missing" | "no_areas" | "no_stations";
  message: string;
  areas_found?: number;
  stations_found_total?: number;
};

export type SeedShiftsResult = SeedShiftsSuccess | SeedShiftsValidationError;

export type SeedShiftsOptions = {
  line?: string | null;
};

/**
 * Load shift_pattern, areas, and stations; validate; then create shifts and shift_assignments.
 * Returns validation error (no DB writes) or success with counts.
 */
export async function runSeedShifts(
  supabase: SupabaseClient,
  orgId: string,
  siteId: string,
  date: string,
  shiftCode: string,
  options?: SeedShiftsOptions
): Promise<SeedShiftsResult> {
  const { data: pattern, error: patternErr } = await supabase
    .from("shift_patterns")
    .select("id")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .eq("shift_code", shiftCode)
    .eq("is_active", true)
    .maybeSingle();

  if (patternErr) {
    console.error("[seedShifts] shift_patterns query error:", patternErr);
    throw new Error(`Failed to fetch shift pattern: ${patternErr.message}`);
  }
  if (!pattern?.id) {
    return {
      ok: false,
      errorCode: "shift_pattern_missing",
      message: `No active shift_pattern for (org_id, site_id, shift_code). Add shift_patterns for site and shift_code "${shiftCode}".`,
    };
  }

  const lineFilter = options?.line?.trim();
  let areasQuery = supabase
    .from("areas")
    .select("id, code, name")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .eq("is_active", true);
  if (lineFilter) {
    areasQuery = areasQuery.or(`code.ilike.${lineFilter},name.ilike.${lineFilter}`);
  }
  const { data: areasData, error: areasErr } = await areasQuery;

  if (areasErr) {
    console.error("[seedShifts] areas query error:", areasErr);
    throw new Error(`Failed to fetch areas: ${areasErr.message}`);
  }
  const areaList = areasData ?? [];
  if (areaList.length === 0) {
    return {
      ok: false,
      errorCode: "no_areas",
      message:
        "No active areas for this site. Add areas (org_id + site_id + is_active=true) before seeding.",
      areas_found: 0,
      stations_found_total: 0,
    };
  }

  let stationsFoundTotal = 0;
  for (const area of areaList) {
    const { data: stations, error: stationsErr } = await supabase
      .from("stations")
      .select("id")
      .eq("org_id", orgId)
      .eq("area_id", area.id)
      .eq("is_active", true);
    if (stationsErr) {
      console.error("[seedShifts] stations query error:", stationsErr);
      throw new Error(`Stations lookup failed: ${stationsErr.message}`);
    }
    stationsFoundTotal += (stations ?? []).length;
  }

  if (stationsFoundTotal === 0) {
    return {
      ok: false,
      errorCode: "no_stations",
      message:
        "No active stations for the resolved areas. Add stations linked to these areas (org_id + area_id + is_active=true) before seeding.",
      areas_found: areaList.length,
      stations_found_total: 0,
    };
  }

  let shiftsCreated = 0;
  let shiftsExisting = 0;
  let assignmentsCreated = 0;
  let assignmentsExisting = 0;

  for (const area of areaList) {
    const { data: existingShift, error: findShiftErr } = await supabase
      .from("shifts")
      .select("id")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("area_id", area.id)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode)
      .maybeSingle();

    if (findShiftErr) {
      console.error("[seedShifts] shift lookup error:", findShiftErr);
      throw new Error(`Shift lookup failed: ${findShiftErr.message}`);
    }

    let shiftId: string;
    if (existingShift?.id) {
      shiftId = existingShift.id;
      shiftsExisting += 1;
    } else {
      const insertPayload = {
        org_id: orgId,
        site_id: siteId,
        area_id: area.id,
        shift_date: date,
        shift_code: shiftCode,
        shift_type: shiftCode,
        name: shiftCode,
        line: area.name ?? area.code ?? "",
        is_active: true,
      };
      const { data: newShift, error: insertShiftErr } = await supabase
        .from("shifts")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertShiftErr || !newShift?.id) {
        const { data: fallbackShift, error: fallbackErr } = await supabase
          .from("shifts")
          .select("id")
          .eq("org_id", orgId)
          .eq("shift_date", date)
          .eq("shift_code", shiftCode)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallbackErr || !fallbackShift?.id) {
          console.error("[seedShifts] shift insert error:", insertShiftErr);
          throw new Error(`Failed to create shift: ${insertShiftErr?.message ?? "Unknown error"}`);
        }
        shiftId = fallbackShift.id;
        shiftsExisting += 1;
      } else {
        shiftId = newShift.id;
        shiftsCreated += 1;
      }
    }

    const { data: stations } = await supabase
      .from("stations")
      .select("id")
      .eq("org_id", orgId)
      .eq("area_id", area.id)
      .eq("is_active", true);
    const stationList = stations ?? [];

    for (const station of stationList) {
      const { data: existingSa } = await supabase
        .from("shift_assignments")
        .select("id")
        .eq("org_id", orgId)
        .eq("shift_id", shiftId)
        .eq("station_id", station.id)
        .maybeSingle();

      if (existingSa?.id) {
        assignmentsExisting += 1;
        continue;
      }

      const { error: insertSaErr } = await supabase
        .from("shift_assignments")
        .upsert(
          {
            org_id: orgId,
            shift_id: shiftId,
            station_id: station.id,
            assignment_date: date,
            employee_id: null,
            status: "unassigned",
          },
          { onConflict: "org_id,shift_id,station_id", ignoreDuplicates: true }
        );

      if (insertSaErr) {
        console.error("[seedShifts] shift_assignment insert error:", insertSaErr);
        continue;
      }
      assignmentsCreated += 1;
    }
  }

  return {
    ok: true,
    areas_found: areaList.length,
    stations_found_total: stationsFoundTotal,
    summary: {
      shifts_created: shiftsCreated,
      shifts_existing: shiftsExisting,
      assignments_created: assignmentsCreated,
      assignments_existing: assignmentsExisting,
      shifts_count: shiftsCreated + shiftsExisting,
      assignments_count: assignmentsCreated + assignmentsExisting,
    },
  };
}
