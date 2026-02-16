/**
 * Required compliance codes for Compliance Matrix (pilot).
 * Shift-based: NIGHT_EXAM for Night/S3. Customer-based: IKEA codes when customer_code === 'IKEA'.
 * Keep in code (API) for flexibility; view returns all catalog rows, API filters by these.
 */

/** Base codes always required (work_environment + medical + sustainability) */
const BASE_CODES = [
  "BAM_GRUND",
  "BAM_FORTS",
  "FIRE_SAFETY",
  "FIRST_AID",
  "CPR",
  "HEARING_TEST",
  "VISION_TEST",
  "GENERAL_HEALTH", // catalog uses GENERAL_HEALTH (alias for HEALTH_CHECK)
  "FSC",
] as const;

/** Night-only codes when shift_code in (Night, S3) case-insensitive */
const NIGHT_CODES = ["NIGHT_EXAM"] as const;

/** IKEA customer codes when customer_code === 'IKEA' */
const IKEA_CODES = ["IKEA_IWAY", "IKEA_BUSINESS_ETHICS"] as const;

function isNightShift(shiftCode: string): boolean {
  const s = (shiftCode ?? "").trim().toLowerCase();
  return s === "night" || s === "s3";
}

function isIkeaCustomer(customerCode: string): boolean {
  return (customerCode ?? "").trim().toUpperCase() === "IKEA";
}

/**
 * Returns the set of compliance codes required for the matrix context.
 * Base codes always; NIGHT_EXAM when shift is Night/S3; IKEA codes when customer is IKEA.
 */
export function requiredCodesForMatrix(
  shiftCode?: string | null,
  customerCode?: string | null
): string[] {
  const codes: string[] = [...BASE_CODES];
  if (shiftCode && isNightShift(shiftCode)) {
    codes.push(...NIGHT_CODES);
  }
  if (customerCode && isIkeaCustomer(customerCode)) {
    codes.push(...IKEA_CODES);
  }
  return [...new Set(codes)];
}
