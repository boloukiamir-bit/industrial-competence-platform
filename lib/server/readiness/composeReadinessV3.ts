/**
 * Deterministic composition of Legal + Ops readiness for cockpit readiness-v3.
 * Single source of truth for overall status and reason_codes.
 */

export type LegalFlag = "LEGAL_GO" | "LEGAL_WARNING" | "LEGAL_NO_GO";
export type OpsFlag = "OPS_GO" | "OPS_WARNING" | "OPS_NO_GO";
export type OverallStatus = "GO" | "WARNING" | "NO_GO";

/** Reason codes returned in overall.reason_codes (deterministic, sorted). */
export const REASON_LEGAL_BLOCKING = "LEGAL_BLOCKING";
export const REASON_LEGAL_EXPIRING = "LEGAL_EXPIRING";
export const REASON_OPS_NO_COVERAGE = "OPS_NO_COVERAGE";
export const REASON_OPS_RISK = "OPS_RISK";

/**
 * Compose overall status from legal and ops flags.
 * - NO_GO if legal NO_GO or ops NO_GO
 * - WARNING if neither NO_GO but either WARNING
 * - GO otherwise
 */
export function composeOverallStatus(legal: LegalFlag, ops: OpsFlag): OverallStatus {
  if (legal === "LEGAL_NO_GO" || ops === "OPS_NO_GO") return "NO_GO";
  if (legal === "LEGAL_WARNING" || ops === "OPS_WARNING") return "WARNING";
  return "GO";
}

/**
 * Build deterministic reason_codes array from legal and ops flags.
 * - LEGAL_NO_GO -> LEGAL_BLOCKING
 * - LEGAL_WARNING -> LEGAL_EXPIRING
 * - OPS_NO_GO -> OPS_NO_COVERAGE
 * - OPS_WARNING -> OPS_RISK
 * Returns sorted array for stable ordering.
 */
export function composeReasonCodes(legal: LegalFlag, ops: OpsFlag): string[] {
  const codes: string[] = [];
  if (legal === "LEGAL_NO_GO") codes.push(REASON_LEGAL_BLOCKING);
  if (legal === "LEGAL_WARNING") codes.push(REASON_LEGAL_EXPIRING);
  if (ops === "OPS_NO_GO") codes.push(REASON_OPS_NO_COVERAGE);
  if (ops === "OPS_WARNING") codes.push(REASON_OPS_RISK);
  return codes.sort();
}
