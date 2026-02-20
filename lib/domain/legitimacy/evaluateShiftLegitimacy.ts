/**
 * Shift Legitimacy Aggregator — pure evaluator over employee legitimacy statuses.
 * No DB access. Used to derive shift-level status from assigned employees.
 */

export type EmployeeLegitimacyStatus = "GO" | "WARNING" | "ILLEGAL" | "RESTRICTED";
export type ShiftLegitimacyStatus = "GO" | "WARNING" | "ILLEGAL";

export interface EvaluateShiftLegitimacyParams {
  employeeLegitimacies: EmployeeLegitimacyStatus[];
}

export interface EvaluateShiftLegitimacyResult {
  shiftStatus: ShiftLegitimacyStatus;
  illegalCount: number;
  restrictedCount: number;
  warningCount: number;
}

/**
 * Aggregates employee legitimacy statuses into a single shift status.
 * - If any ILLEGAL or RESTRICTED → shiftStatus = "ILLEGAL"
 * - Else if any WARNING → shiftStatus = "WARNING"
 * - Else → "GO"
 */
export function evaluateShiftLegitimacy(
  params: EvaluateShiftLegitimacyParams
): EvaluateShiftLegitimacyResult {
  const { employeeLegitimacies } = params;
  let illegalCount = 0;
  let restrictedCount = 0;
  let warningCount = 0;

  for (const s of employeeLegitimacies) {
    if (s === "ILLEGAL") illegalCount += 1;
    else if (s === "RESTRICTED") restrictedCount += 1;
    else if (s === "WARNING") warningCount += 1;
  }

  const shiftStatus: ShiftLegitimacyStatus =
    illegalCount > 0 || restrictedCount > 0
      ? "ILLEGAL"
      : warningCount > 0
        ? "WARNING"
        : "GO";

  return {
    shiftStatus,
    illegalCount,
    restrictedCount,
    warningCount,
  };
}
