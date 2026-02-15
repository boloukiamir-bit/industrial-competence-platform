/**
 * Single source of truth for cockpit shift normalization.
 * Canonical values must match DB (v_cockpit_station_summary.shift_code).
 */

const COCKPIT_SHIFT_MAP: Record<string, string> = {
  s1: "S1",
  s2: "S2",
  s3: "S3",
  day: "Day",
  evening: "Evening",
  night: "Night",
};

/**
 * Normalize shift param for cockpit APIs. Case-insensitive.
 * Accepts S1, S2, S3, Day, Evening, Night. Returns canonical form or null if invalid.
 */
export function normalizeShiftParam(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  return COCKPIT_SHIFT_MAP[key] ?? null;
}
