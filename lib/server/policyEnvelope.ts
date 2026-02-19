/**
 * Canonical policy envelope for cockpit API responses and fingerprinting.
 * Policy is always { units, compliance }; no polymorphic array/object.
 */
import type { PolicyComplianceBlock } from "@/lib/server/getCockpitReadiness";

export type PolicyUnit = { unit_id: string; industry_type: string; version: number };

export type PolicyEnvelope = {
  units: PolicyUnit[];
  compliance: PolicyComplianceBlock;
};

const DEFAULT_COMPLIANCE: PolicyComplianceBlock = {
  stations: [],
  totals: {
    blocking_stations: 0,
    warning_stations: 0,
    blocking_items: 0,
    warning_items: 0,
  },
};

/**
 * Build canonical policy envelope for API responses and fingerprint input.
 * Always returns an object with keys `units` and `compliance` (both always present).
 */
export function toPolicyEnvelope(
  readinessPolicyUnitsArray: PolicyUnit[] | null | undefined,
  policy_compliance?: PolicyComplianceBlock | null
): PolicyEnvelope {
  return {
    units: readinessPolicyUnitsArray ?? [],
    compliance: policy_compliance ?? DEFAULT_COMPLIANCE,
  };
}

export { DEFAULT_COMPLIANCE };
