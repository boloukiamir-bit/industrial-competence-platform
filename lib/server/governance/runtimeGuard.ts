/**
 * Runtime Legitimacy Guard – Phase A.
 * Pure, deterministic check: NO_GO readiness blocks execution (409).
 * No DB access. No side effects.
 */

export type RuntimeGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 409;
      error: {
        kind: "RUNTIME";
        code: "RUNTIME_NO_GO";
        readiness_status: string;
        reason_codes: string[];
      };
    };

export function assertExecutionLegitimacy(params: {
  readiness_status: string;
  reason_codes: string[];
}): RuntimeGuardResult {
  const { readiness_status, reason_codes } = params;
  if (readiness_status === "NO_GO") {
    return {
      allowed: false,
      status: 409,
      error: {
        kind: "RUNTIME",
        code: "RUNTIME_NO_GO",
        readiness_status,
        reason_codes,
      },
    };
  }
  return { allowed: true };
}
