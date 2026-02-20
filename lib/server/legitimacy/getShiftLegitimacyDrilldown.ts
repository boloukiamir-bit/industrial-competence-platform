/**
 * Shift Legitimacy Drilldown — read-only. Loads assigned employees, evaluates
 * legitimacy per employee (compliance + induction), aggregates and returns
 * shift status plus blocking/warning employee lists with reasons.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateEmployeeLegitimacy } from "@/lib/domain/legitimacy/evaluateEmployeeLegitimacy";
import type { ComplianceStatusForLegitimacy } from "@/lib/domain/legitimacy/evaluateEmployeeLegitimacy";
import { evaluateShiftLegitimacy } from "@/lib/domain/legitimacy/evaluateShiftLegitimacy";
import { evaluateEmployeeComplianceV2 } from "@/lib/server/compliance/evaluateEmployeeComplianceV2";
import { getInductionStatusForLegitimacy } from "@/lib/server/induction/inductionService";
import type { EvaluatorCellStatus } from "@/lib/server/compliance/evaluateEmployeeComplianceV2";

export type ShiftLegitimacyDrilldownStatus = "GO" | "WARNING" | "ILLEGAL";

export interface BlockingEmployee {
  id: string;
  name: string;
  reasons: string[];
}

export interface WarningEmployee {
  id: string;
  name: string;
  reasons: string[];
}

export interface GetShiftLegitimacyDrilldownParams {
  orgId: string;
  siteId: string | null;
  shiftId: string;
  referenceDate: Date;
}

export interface GetShiftLegitimacyDrilldownResult {
  shift_status: ShiftLegitimacyDrilldownStatus;
  blocking_employees: BlockingEmployee[];
  warning_employees: WarningEmployee[];
}

function evaluatorStatusToExpiryStatus(s: EvaluatorCellStatus): ComplianceStatusForLegitimacy {
  if (s === "overdue") return "ILLEGAL";
  if (s === "expiring") return "WARNING";
  return "VALID";
}

function reasonsFromLegitimacy(result: {
  legitimacyStatus: string;
  blockers: string[];
  warnings: string[];
}): string[] {
  const reasons: string[] = [];
  if (result.legitimacyStatus === "RESTRICTED") {
    reasons.push("INDUCTION_INCOMPLETE");
  }
  if (result.blockers.includes("COMPLIANCE_EXPIRED")) {
    reasons.push("COMPLIANCE_EXPIRED");
  }
  if (result.blockers.includes("DISCIPLINARY_RESTRICTION")) {
    reasons.push("DISCIPLINARY_RESTRICTION");
  }
  if (result.warnings.includes("COMPLIANCE_EXPIRING")) {
    reasons.push("COMPLIANCE_EXPIRING");
  }
  return reasons;
}

function displayName(row: { name?: string | null; first_name?: string | null; last_name?: string | null }): string {
  if (row.name && String(row.name).trim()) return String(row.name).trim();
  const parts = [row.first_name, row.last_name].filter(Boolean).map(String);
  return parts.length > 0 ? parts.join(" ").trim() : "";
}

/**
 * Returns shift legitimacy drilldown: shift status plus lists of blocking and
 * warning employees with reasons. No DB writes.
 */
export async function getShiftLegitimacyDrilldown(
  admin: SupabaseClient,
  params: GetShiftLegitimacyDrilldownParams
): Promise<GetShiftLegitimacyDrilldownResult> {
  const { orgId, siteId, shiftId, referenceDate } = params;

  const { data: saRows } = await admin
    .from("shift_assignments")
    .select("employee_id")
    .eq("shift_id", shiftId)
    .eq("org_id", orgId);

  const employeeIds = [
    ...new Set(
      (saRows ?? [])
        .map((r: { employee_id: string | null }) => r.employee_id)
        .filter((id): id is string => id != null && id !== "")
    ),
  ];

  if (employeeIds.length === 0) {
    const aggregated = evaluateShiftLegitimacy({ employeeLegitimacies: [] });
    return {
      shift_status: aggregated.shiftStatus,
      blocking_employees: [],
      warning_employees: [],
    };
  }

  const { data: empRows } = await admin
    .from("employees")
    .select("id, name, first_name, last_name")
    .in("id", employeeIds);

  const employeeMap = new Map<string, { id: string; name: string }>();
  for (const row of empRows ?? []) {
    const r = row as { id: string; name?: string | null; first_name?: string | null; last_name?: string | null };
    employeeMap.set(r.id, { id: r.id, name: displayName(r) || r.id });
  }

  const legitimacies: Array<"GO" | "WARNING" | "ILLEGAL" | "RESTRICTED"> = [];
  const details: Array<{ employeeId: string; status: "GO" | "WARNING" | "ILLEGAL" | "RESTRICTED"; reasons: string[] }> = [];

  for (const employeeId of employeeIds) {
    const applicableRows = await evaluateEmployeeComplianceV2(admin, {
      orgId,
      siteId,
      employeeId,
      referenceDate,
      expiringDaysDefault: 30,
    });
    const complianceStatuses: ComplianceStatusForLegitimacy[] = applicableRows.map((r) =>
      evaluatorStatusToExpiryStatus(r.status)
    );
    const inductionStatus = await getInductionStatusForLegitimacy(admin, {
      orgId,
      siteId,
      employeeId,
    });
    const result = evaluateEmployeeLegitimacy({
      complianceStatuses,
      inductionStatus,
      disciplinaryRestriction: false,
    });
    legitimacies.push(result.legitimacyStatus);
    details.push({
      employeeId,
      status: result.legitimacyStatus,
      reasons: reasonsFromLegitimacy(result),
    });
  }

  const aggregated = evaluateShiftLegitimacy({ employeeLegitimacies: legitimacies });

  const blocking_employees: BlockingEmployee[] = [];
  const warning_employees: WarningEmployee[] = [];

  for (const d of details) {
    const emp = employeeMap.get(d.employeeId) ?? { id: d.employeeId, name: d.employeeId };
    const entry = { id: emp.id, name: emp.name, reasons: d.reasons };
    if (d.status === "ILLEGAL" || d.status === "RESTRICTED") {
      blocking_employees.push(entry);
    } else if (d.status === "WARNING") {
      warning_employees.push(entry);
    }
  }

  return {
    shift_status: aggregated.shiftStatus,
    blocking_employees,
    warning_employees,
  };
}
