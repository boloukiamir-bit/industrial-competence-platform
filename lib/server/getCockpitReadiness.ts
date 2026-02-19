/**
 * Single source of truth for cockpit readiness + policy binding.
 * Used by: /api/cockpit/readiness, /api/cockpit/summary, /api/cockpit/issues.
 * Never throws; returns safe fallbacks when shift/site missing or RPC fails.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyBindingResult } from "@/lib/server/policyBinding";
import {
  resolvePolicyBindingForShift,
  persistPolicySnapshots,
} from "@/lib/server/policyBinding";
import { normalizeReasonCodes } from "@/lib/server/governance/reasonCodes";

export type ReadinessStatus = "GO" | "WARNING" | "NO_GO";

/** Compliance block from calculate_industrial_readiness_v2 (Phase B). */
export type PolicyComplianceBlock = {
  stations: Array<{
    station_id: string;
    legal_stop: boolean;
    blocking_count: number;
    warning_count: number;
    reason_codes: string[];
  }>;
  totals: {
    blocking_stations: number;
    warning_stations: number;
    blocking_items: number;
    warning_items: number;
  };
};

export type CockpitReadinessResult = {
  readiness_score: number;
  readiness_status: ReadinessStatus;
  blocking_stations: string[];
  reason_codes: string[];
  calculated_at: string;
  legitimacy_status: "LEGAL_STOP" | "OK";
  policy: Array<{ unit_id: string; industry_type: string; version: number }>;
  /** Phase B: compliance per station + totals (from v2 RPC). Expose as policy.compliance in API. */
  policy_compliance?: PolicyComplianceBlock | null;
  /** Internal only: unknown codes replaced by UNKNOWN_REASON_CODE. Not exposed in API. */
  unknown_reason_codes?: string[];
};

const SORTED_EMPTY: string[] = [];

function sortedReasonCodes(codes: string[]): string[] {
  if (!codes.length) return SORTED_EMPTY;
  return [...codes].sort((a, b) => a.localeCompare(b));
}

function policyMetadata(binding: PolicyBindingResult): CockpitReadinessResult["policy"] {
  if (!binding.ok) return [];
  return Array.from(binding.policiesByUnit.values()).map((p) => ({
    unit_id: p.unit_id,
    industry_type: p.industry_type,
    version: p.version,
  }));
}

function noGoResult(
  reasonCodes: string[],
  legitimacy: "LEGAL_STOP" | "OK" = "LEGAL_STOP",
  policy: CockpitReadinessResult["policy"] = []
): CockpitReadinessResult {
  const normalized = normalizeReasonCodes(sortedReasonCodes(reasonCodes));
  return {
    readiness_score: 0,
    readiness_status: "NO_GO",
    blocking_stations: [],
    reason_codes: normalized.reason_codes,
    calculated_at: new Date().toISOString(),
    legitimacy_status: legitimacy,
    policy,
    ...(normalized.unknown.length > 0 && { unknown_reason_codes: normalized.unknown }),
  };
}

/**
 * Resolve first shift_id for (org, site, date, shift_code). Returns null if none.
 */
export async function getFirstShiftIdForCockpit(
  supabase: SupabaseClient,
  params: { orgId: string; siteId: string | null; date: string; shift_code: string }
): Promise<string | null> {
  const { orgId, siteId, date, shift_code } = params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !shift_code?.trim()) return null;
  let query = supabase
    .from("shifts")
    .select("id")
    .eq("org_id", orgId)
    .eq("shift_date", date)
    .eq("shift_code", shift_code.trim())
    .limit(1);
  if (siteId) {
    query = query.or(`site_id.is.null,site_id.eq.${siteId}`);
  }
  const { data: rows, error } = await query;
  if (error || !rows?.length) return null;
  const id = (rows[0] as { id: string }).id;
  return id ?? null;
}

function mapRowToReadiness(
  row: {
    readiness_score?: number | null;
    status?: string | null;
    blocking_stations?: string[] | unknown[] | null;
    reason_codes?: string[] | null;
    calculated_at?: string | null;
    legitimacy_status?: string | null;
    compliance?: PolicyComplianceBlock | null;
  },
  opts?: { policy_compliance?: PolicyComplianceBlock | null }
): Omit<CockpitReadinessResult, "policy"> {
  const status: ReadinessStatus =
    row.status === "GO" || row.status === "WARNING" || row.status === "NO_GO"
      ? row.status
      : "NO_GO";
  const blocking = Array.isArray(row.blocking_stations)
    ? row.blocking_stations.map((id) => (typeof id === "string" ? id : String(id)))
    : [];
  const reasonCodes = Array.isArray(row.reason_codes) ? row.reason_codes : [];
  const out: Omit<CockpitReadinessResult, "policy"> = {
    readiness_score: Number(row.readiness_score ?? 0),
    readiness_status: status,
    blocking_stations: blocking,
    reason_codes: sortedReasonCodes(reasonCodes),
    calculated_at: row.calculated_at ? String(row.calculated_at) : new Date().toISOString(),
    legitimacy_status:
      row.legitimacy_status === "LEGAL_STOP" || row.legitimacy_status === "OK"
        ? row.legitimacy_status
        : "OK",
  };
  const compliance = row.compliance ?? opts?.policy_compliance;
  if (compliance && typeof compliance === "object" && Array.isArray(compliance.stations)) {
    out.policy_compliance = compliance as PolicyComplianceBlock;
  }
  return out;
}

export type GetCockpitReadinessParams = {
  supabase: SupabaseClient;
  admin: SupabaseClient | null;
  orgId: string;
  siteId: string | null;
  /** When provided, used directly. Otherwise resolved from date + shift_code. */
  shiftId?: string | null;
  date?: string;
  shift_code?: string;
};

/**
 * Compute cockpit readiness for a shift (single source of truth).
 * - If shiftId not provided, resolves it from date + shift_code when both are set.
 * - If siteId is null, returns NO_GO with reason_codes ["NO_SITE"] and no policy.
 * - If shift cannot be resolved, returns NO_GO with reason_codes ["NO_SHIFT"].
 * - Runs policy binding when admin is set; on binding failure returns LEGAL_STOP + POLICY_MISSING/UNIT_MISSING.
 * - Calls calculate_industrial_readiness_v2 when available (compliance-aware), else calculate_industrial_readiness (v1 fallback); persists policy snapshots on success.
 */
export async function getCockpitReadiness(
  params: GetCockpitReadinessParams
): Promise<CockpitReadinessResult> {
  const { supabase, admin, orgId, siteId, shiftId: paramShiftId, date, shift_code } = params;

  if (!siteId) {
    return noGoResult(["NO_SITE"]);
  }

  let shiftId: string | null = paramShiftId ?? null;
  if (!shiftId && date && shift_code) {
    shiftId = await getFirstShiftIdForCockpit(supabase, {
      orgId,
      siteId,
      date,
      shift_code: shift_code.trim(),
    });
  }

  if (!shiftId) {
    return noGoResult(["NO_SHIFT"]);
  }

  const policyBinding = admin
    ? await resolvePolicyBindingForShift(admin, orgId, shiftId)
    : ({ ok: true as const, policiesByUnit: new Map(), stationToUnit: new Map(), unitIds: [] } satisfies PolicyBindingResult);

  if (!policyBinding.ok) {
    return noGoResult(policyBinding.reason_codes, "LEGAL_STOP", []);
  }

  // Prefer v2 (compliance-aware); fall back to v1 if v2 is not available (e.g. migration not applied).
  const v2Result = await supabase.rpc("calculate_industrial_readiness_v2", {
    p_org_id: orgId,
    p_site_id: siteId,
    p_shift_id: shiftId,
  });

  const useV2 =
    !v2Result.error &&
    (Array.isArray(v2Result.data) ? v2Result.data.length > 0 : v2Result.data != null);

  if (useV2) {
    const row = Array.isArray(v2Result.data) ? v2Result.data[0] : v2Result.data;
    if (row) {
      const base = mapRowToReadiness(row as Parameters<typeof mapRowToReadiness>[0]);
      const normalized = normalizeReasonCodes(base.reason_codes);
      if (admin && policyBinding.ok && policyBinding.policiesByUnit.size > 0) {
        await persistPolicySnapshots(admin, shiftId, policyBinding.policiesByUnit);
      }
      return {
        ...base,
        reason_codes: normalized.reason_codes,
        policy: policyMetadata(policyBinding),
        ...(normalized.unknown.length > 0 && { unknown_reason_codes: normalized.unknown }),
      };
    }
  }

  const { data: rows, error } = await supabase.rpc("calculate_industrial_readiness", {
    p_org_id: orgId,
    p_site_id: siteId,
    p_shift_id: shiftId,
  });

  if (error) {
    const fallback = await supabase.rpc("calculate_industrial_readiness_v1", {
      p_org_id: orgId,
      p_site_id: siteId,
      p_shift_id: shiftId,
    });
    if (fallback.error) {
      return {
        ...noGoResult(["NO_ASSIGNMENTS"], "OK", policyMetadata(policyBinding)),
        legitimacy_status: "OK",
        policy: policyMetadata(policyBinding),
      };
    }
    const row = Array.isArray(fallback.data) ? fallback.data[0] : fallback.data;
    const base = mapRowToReadiness(row ?? {});
    const normalized = normalizeReasonCodes(base.reason_codes);
    return {
      ...base,
      reason_codes: normalized.reason_codes,
      legitimacy_status: "OK",
      policy: policyMetadata(policyBinding),
      ...(normalized.unknown.length > 0 && { unknown_reason_codes: normalized.unknown }),
    };
  }

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) {
    return {
      ...noGoResult(["NO_ASSIGNMENTS"], "OK", policyMetadata(policyBinding)),
      legitimacy_status: "OK",
      policy: policyMetadata(policyBinding),
    };
  }

  const base = mapRowToReadiness(row as Parameters<typeof mapRowToReadiness>[0]);
  const normalized = normalizeReasonCodes(base.reason_codes);
  if (admin && policyBinding.ok && policyBinding.policiesByUnit.size > 0) {
    await persistPolicySnapshots(admin, shiftId, policyBinding.policiesByUnit);
  }
  return {
    ...base,
    reason_codes: normalized.reason_codes,
    legitimacy_status: base.legitimacy_status ?? "OK",
    policy: policyMetadata(policyBinding),
    ...(normalized.unknown.length > 0 && { unknown_reason_codes: normalized.unknown }),
  };
}
