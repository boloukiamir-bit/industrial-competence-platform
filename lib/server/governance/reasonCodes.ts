/**
 * Phase A – Reason code registry. Prevents drift by enforcing an allowlist.
 * Unknown codes are replaced with UNKNOWN_REASON_CODE in reason_codes and captured in unknown[].
 */

export const KNOWN_REASON_CODES = new Set<string>([
  "NO_SITE",
  "NO_SHIFT",
  "POLICY_MISSING",
  "UNIT_MISSING",
  "NO_ASSIGNMENTS",
  "COMPLIANCE_MISSING",
  "COMPLIANCE_EXPIRED",
  "COMPLIANCE_EXPIRING",
  "COMPLIANCE_BLOCKER",
  "UNKNOWN_REASON_CODE",
]);

export function normalizeReasonCodes(input: string[] | null | undefined): {
  reason_codes: string[];
  unknown: string[];
} {
  const raw = input ?? [];
  const deduped = [...new Set(raw)];
  const sorted = deduped.sort((a, b) => a.localeCompare(b));
  const unknown = sorted.filter((c) => !KNOWN_REASON_CODES.has(c));
  const known = sorted.filter((c) => KNOWN_REASON_CODES.has(c));
  const reason_codes =
    unknown.length > 0 ? [...known, "UNKNOWN_REASON_CODE"].sort((a, b) => a.localeCompare(b)) : known;
  return {
    reason_codes,
    unknown,
  };
}
