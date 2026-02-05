/**
 * Server-only compliance status helpers. Shared by inbox and export so filter/sort logic is identical.
 */

export type ComplianceStatusFlag =
  | "expired"
  | "missing"
  | "expiring"
  | "waived"
  | "valid";

export function computeComplianceStatus(
  validTo: string | null,
  waived: boolean
): ComplianceStatusFlag {
  if (waived) return "waived";
  if (!validTo) return "missing";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const days30 = new Date(today);
  days30.setDate(days30.getDate() + 30);
  if (to < today) return "expired";
  if (to <= days30) return "expiring";
  return "valid";
}

export function complianceDaysLeft(validTo: string | null): number | null {
  if (!validTo) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  return Math.ceil((to.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
