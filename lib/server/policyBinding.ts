/**
 * Unit-level policy binding for readiness/legitimacy evaluation.
 * Resolves active unit_policy + policy_templates per unit in scope; returns POLICY_MISSING / UNIT_MISSING when required.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export type PolicyTemplateRow = {
  unit_id: string;
  industry_type: string;
  version: number;
  weight_config: unknown;
  threshold_config: unknown;
  penalty_config: unknown;
  feasibility_config: unknown;
};

export type PolicyBindingResult =
  | {
      ok: true;
      policiesByUnit: Map<string, PolicyTemplateRow>;
      stationToUnit: Map<string, string>;
      unitIds: string[];
    }
  | {
      ok: false;
      legitimacy_status: "LEGAL_STOP";
      reason_codes: string[];
      missing_unit_station_ids: string[];
      missing_policy_unit_ids: string[];
    };

function hashConfig(config: unknown): string {
  const json = JSON.stringify(config ?? {});
  return createHash("sha256").update(json).digest("hex").slice(0, 32);
}

/**
 * Get distinct station_ids in scope for the shift (from shift_assignments), and their org_unit_id from stations.
 */
async function getStationsAndUnits(
  supabase: SupabaseClient,
  orgId: string,
  shiftId: string
): Promise<{ stationIds: string[]; stationToUnit: Map<string, string>; missingUnitStationIds: string[] }> {
  const { data: saRows, error: saError } = await supabase
    .from("shift_assignments")
    .select("station_id")
    .eq("org_id", orgId)
    .eq("shift_id", shiftId);

  if (saError || !saRows?.length) {
    return { stationIds: [], stationToUnit: new Map(), missingUnitStationIds: [] };
  }

  const stationIds = Array.from(new Set((saRows as { station_id: string }[]).map((r) => r.station_id).filter(Boolean)));
  if (stationIds.length === 0) {
    return { stationIds: [], stationToUnit: new Map(), missingUnitStationIds: [] };
  }

  const { data: stationRows, error: stError } = await supabase
    .from("stations")
    .select("id, org_unit_id")
    .eq("org_id", orgId)
    .in("id", stationIds);

  if (stError) {
    return { stationIds, stationToUnit: new Map(), missingUnitStationIds: stationIds };
  }

  const stationToUnit = new Map<string, string>();
  const missingUnitStationIds: string[] = [];
  for (const row of (stationRows ?? []) as { id: string; org_unit_id: string | null }[]) {
    if (row.org_unit_id) {
      stationToUnit.set(row.id, row.org_unit_id);
    } else {
      missingUnitStationIds.push(row.id);
    }
  }
  for (const sid of stationIds) {
    if (!stationToUnit.has(sid)) {
      missingUnitStationIds.push(sid);
    }
  }
  return { stationIds, stationToUnit, missingUnitStationIds };
}

/**
 * Get active policy per unit (latest by effective_from DESC, created_at DESC).
 * Fetches unit_policy then policy_templates.
 */
async function getActivePoliciesForUnits(
  supabase: SupabaseClient,
  unitIds: string[]
): Promise<Map<string, PolicyTemplateRow>> {
  if (unitIds.length === 0) return new Map();

  const { data: upRows, error: upError } = await supabase
    .from("unit_policy")
    .select("unit_id, template_id, effective_from, created_at")
    .in("unit_id", unitIds)
    .eq("active", true)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false });

  if (upError || !upRows?.length) return new Map();

  const firstPerUnit = new Map<string, { unit_id: string; template_id: string }>();
  for (const row of upRows as Array<{ unit_id: string; template_id: string }>) {
    if (row.unit_id && row.template_id && !firstPerUnit.has(row.unit_id)) {
      firstPerUnit.set(row.unit_id, { unit_id: row.unit_id, template_id: row.template_id });
    }
  }
  const templateIds = Array.from(new Set(Array.from(firstPerUnit.values()).map((v) => v.template_id)));
  const { data: ptRows, error: ptError } = await supabase
    .from("policy_templates")
    .select("id, industry_type, version, weight_config, threshold_config, penalty_config, feasibility_config")
    .in("id", templateIds);

  if (ptError || !ptRows?.length) return new Map();

  const templateById = new Map(
    (ptRows as Array<{
      id: string;
      industry_type: string;
      version: number;
      weight_config: unknown;
      threshold_config: unknown;
      penalty_config: unknown;
      feasibility_config: unknown;
    }>).map((t) => [t.id, t])
  );

  const byUnit = new Map<string, PolicyTemplateRow>();
  for (const [, { unit_id, template_id }] of firstPerUnit) {
    const t = templateById.get(template_id);
    if (!t) continue;
    byUnit.set(unit_id, {
      unit_id,
      industry_type: t.industry_type,
      version: t.version,
      weight_config: t.weight_config,
      threshold_config: t.threshold_config,
      penalty_config: t.penalty_config,
      feasibility_config: t.feasibility_config,
    });
  }
  return byUnit;
}

/**
 * Resolve unit-level policy binding for a shift.
 * Returns ok:false with LEGAL_STOP and reason_codes (POLICY_MISSING, UNIT_MISSING) when any station has no unit or any unit has no active policy.
 */
export async function resolvePolicyBindingForShift(
  supabase: SupabaseClient,
  orgId: string,
  shiftId: string
): Promise<PolicyBindingResult> {
  const { stationIds, stationToUnit, missingUnitStationIds } = await getStationsAndUnits(supabase, orgId, shiftId);

  if (stationIds.length === 0) {
    return {
      ok: true,
      policiesByUnit: new Map(),
      stationToUnit: new Map(),
      unitIds: [],
    };
  }

  if (missingUnitStationIds.length > 0) {
    return {
      ok: false,
      legitimacy_status: "LEGAL_STOP",
      reason_codes: ["UNIT_MISSING", "POLICY_MISSING"],
      missing_unit_station_ids: missingUnitStationIds,
      missing_policy_unit_ids: [],
    };
  }

  const unitIds = Array.from(new Set(stationToUnit.values()));
  const policiesByUnit = await getActivePoliciesForUnits(supabase, unitIds);
  const missingPolicyUnitIds = unitIds.filter((uid) => !policiesByUnit.has(uid));

  if (missingPolicyUnitIds.length > 0) {
    return {
      ok: false,
      legitimacy_status: "LEGAL_STOP",
      reason_codes: ["POLICY_MISSING"],
      missing_unit_station_ids: [],
      missing_policy_unit_ids: missingPolicyUnitIds,
    };
  }

  return {
    ok: true,
    policiesByUnit,
    stationToUnit,
    unitIds,
  };
}

/**
 * Persist policy snapshots for audit (idempotent by shift_id, unit_id, version).
 */
export async function persistPolicySnapshots(
  supabase: SupabaseClient,
  shiftId: string,
  policiesByUnit: Map<string, PolicyTemplateRow>
): Promise<void> {
  for (const [, policy] of policiesByUnit) {
    const configHash = hashConfig({
      weight_config: policy.weight_config,
      threshold_config: policy.threshold_config,
      penalty_config: policy.penalty_config,
      feasibility_config: policy.feasibility_config,
    });
    await supabase.from("shift_policy_snapshots").upsert(
      {
        shift_id: shiftId,
        unit_id: policy.unit_id,
        industry_type: policy.industry_type,
        version: policy.version,
        config_hash: configHash,
      },
      { onConflict: "shift_id,unit_id,version" }
    );
  }
}
