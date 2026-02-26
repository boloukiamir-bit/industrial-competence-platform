/**
 * Deterministic contract compliance status (Daniel P0).
 * UTC date-only comparisons. Mirrors v_employee_contract_status view.
 */

export type ContractStatus = "GO" | "WARNING" | "ILLEGAL";

export type ContractStatusResult = {
  status: ContractStatus;
  reason_code: string | null;
  due_date: string | null;
  days_to_expiry: number | null;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateOnly(s: string | null | undefined): string | null {
  if (s == null || String(s).trim() === "") return null;
  const d = new Date(s.trim() + "T00:00:00.000Z");
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

export function computeContractStatus(row: {
  employment_status?: string | null;
  contract_end_date?: string | null;
}): ContractStatusResult {
  const today = todayUtc();
  const employmentStatus =
    row.employment_status != null ? String(row.employment_status).trim() : null;
  const endDate = parseDateOnly(row.contract_end_date);

  if (employmentStatus !== "ACTIVE") {
    return { status: "GO", reason_code: null, due_date: null, days_to_expiry: null };
  }
  if (endDate == null) {
    return {
      status: "WARNING",
      reason_code: "CONTRACT_MISSING_END_DATE",
      due_date: today,
      days_to_expiry: null,
    };
  }
  if (endDate < today) {
    const days = Math.floor(
      (new Date(endDate).getTime() - new Date(today).getTime()) / 86400000
    );
    return {
      status: "ILLEGAL",
      reason_code: "CONTRACT_EXPIRED",
      due_date: endDate,
      days_to_expiry: days,
    };
  }
  const daysUntilExpiry = Math.floor(
    (new Date(endDate).getTime() - new Date(today).getTime()) / 86400000
  );
  if (daysUntilExpiry <= 30) {
    return {
      status: "WARNING",
      reason_code: "CONTRACT_EXPIRING_SOON",
      due_date: endDate,
      days_to_expiry: daysUntilExpiry,
    };
  }
  return { status: "GO", reason_code: null, due_date: endDate, days_to_expiry: daysUntilExpiry };
}
