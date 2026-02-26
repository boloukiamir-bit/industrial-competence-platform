/**
 * Normalize shift code for roster/staging lookups.
 * S1 -> "1", S2 -> "2", S3 -> "3"; Day/Evening/Night unchanged.
 * Used when querying stg_roster_v1 where shift may be stored as numeric string.
 */
export function normalizeShiftCode(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return raw;
  const match = raw.match(/^S(\d+)$/i);
  if (match) return match[1];
  return raw;
}
