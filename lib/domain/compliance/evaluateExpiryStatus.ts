/**
 * Certificate Expiry Engine — pure evaluator for compliance/certificate expiry.
 * No side effects; referenceDate is passed in (no implicit "now").
 * Date-only comparison for deterministic, timezone-safe behaviour.
 */

export type ExpiryStatus = "VALID" | "WARNING" | "ILLEGAL";

/** Normalize to integer days since Unix epoch (UTC date-only) for comparison. */
function toEpochDays(value: Date | string): number {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 86400000);
}

/**
 * Evaluates expiry status from a reference date and reminder window.
 * - null expiry → VALID (no requirement to expire)
 * - expiry &lt;= referenceDate (date-only) → ILLEGAL (expired or expiring today)
 * - expiry &lt;= referenceDate + reminderOffsetDays → WARNING
 * - else → VALID
 */
export function evaluateExpiryStatus(params: {
  expiryDate: string | Date | null;
  reminderOffsetDays: number;
  referenceDate: Date;
}): ExpiryStatus {
  const { expiryDate, reminderOffsetDays, referenceDate } = params;
  if (expiryDate == null) return "VALID";

  const refDays = toEpochDays(referenceDate);
  const expDays = toEpochDays(expiryDate);

  if (expDays <= refDays) return "ILLEGAL";
  if (expDays <= refDays + reminderOffsetDays) return "WARNING";
  return "VALID";
}
