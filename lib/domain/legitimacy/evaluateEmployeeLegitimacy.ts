/**
 * Employee Legitimacy Aggregator — pure evaluator for GO/WARNING/ILLEGAL/RESTRICTED.
 * No DB access; strict priority ordering.
 */

export type ComplianceStatusForLegitimacy = "VALID" | "WARNING" | "ILLEGAL";
export type InductionStatus = "RESTRICTED" | "CLEARED";
export type LegitimacyStatus = "GO" | "WARNING" | "ILLEGAL" | "RESTRICTED";

export interface EvaluateEmployeeLegitimacyParams {
  complianceStatuses: ComplianceStatusForLegitimacy[];
  inductionStatus: InductionStatus;
  disciplinaryRestriction: boolean;
}

export interface EvaluateEmployeeLegitimacyResult {
  legitimacyStatus: LegitimacyStatus;
  blockers: string[];
  warnings: string[];
}

/**
 * Evaluates employee legitimacy from compliance, induction, and disciplinary state.
 * Rules applied in strict order: RESTRICTED then disciplinary then compliance ILLEGAL then compliance WARNING then GO.
 */
export function evaluateEmployeeLegitimacy(
  params: EvaluateEmployeeLegitimacyParams
): EvaluateEmployeeLegitimacyResult {
  const { complianceStatuses, inductionStatus, disciplinaryRestriction } = params;

  if (inductionStatus === "RESTRICTED") {
    return { legitimacyStatus: "RESTRICTED", blockers: [], warnings: [] };
  }

  if (disciplinaryRestriction === true) {
    return {
      legitimacyStatus: "ILLEGAL",
      blockers: ["DISCIPLINARY_RESTRICTION"],
      warnings: [],
    };
  }

  if (complianceStatuses.some((s) => s === "ILLEGAL")) {
    return {
      legitimacyStatus: "ILLEGAL",
      blockers: ["COMPLIANCE_EXPIRED"],
      warnings: [],
    };
  }

  if (complianceStatuses.some((s) => s === "WARNING")) {
    return {
      legitimacyStatus: "WARNING",
      blockers: [],
      warnings: ["COMPLIANCE_EXPIRING"],
    };
  }

  return { legitimacyStatus: "GO", blockers: [], warnings: [] };
}
