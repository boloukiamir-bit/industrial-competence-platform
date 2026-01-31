/**
 * Single source of truth for shift parsing and normalization.
 * Canonical shift type: "Day" | "Evening" | "Night" (DB and internal).
 * APIs accept both cases (Day/day, etc.); normalize to canonical for storage and comparison.
 */

export type CanonicalShiftType = "Day" | "Evening" | "Night";
export type QueryShiftType = "day" | "evening" | "night";

const LOWER_TO_CANONICAL: Record<string, CanonicalShiftType> = {
  day: "Day",
  evening: "Evening",
  night: "Night",
};

/**
 * Normalize any shift string to canonical "Day" | "Evening" | "Night", or null if invalid.
 * Accepts "day", "Day", "DAY", etc. (case-insensitive, trims whitespace).
 * This is the single source of truth for shift normalization.
 * 
 * @param input - shift string from any source (query param, body, etc.)
 * @returns Canonical shift type or null if invalid
 * 
 * @example
 * normalizeShift("day") // "Day"
 * normalizeShift("Day") // "Day"
 * normalizeShift("DAY") // "Day"
 * normalizeShift("evening") // "Evening"
 * normalizeShift("invalid") // null
 * normalizeShift(null) // null
 */
export function normalizeShift(input: string | null | undefined): CanonicalShiftType | null {
  if (input == null || typeof input !== "string") return null;
  const key = input.trim().toLowerCase();
  return LOWER_TO_CANONICAL[key] ?? null;
}

/**
 * Alias for normalizeShift - kept for backward compatibility.
 * @deprecated Use normalizeShift instead
 */
export function normalizeShiftType(input: string | null | undefined): CanonicalShiftType | null {
  return normalizeShift(input);
}

/**
 * Convert canonical shift to lowercase for query params / URLs (e.g. shift=day).
 */
export function toQueryShiftType(canonical: CanonicalShiftType): QueryShiftType {
  return canonical.toLowerCase() as QueryShiftType;
}

/**
 * Normalize with default: returns "Day" if input is invalid. Use when API should default.
 */
export function normalizeShiftTypeOrDefault(input: string | null | undefined): CanonicalShiftType {
  return normalizeShift(input) ?? "Day";
}

/**
 * Parse shift from query param with default fallback to "Day".
 * Use in API routes; return 400 if result is null when no default is acceptable.
 * 
 * @param value - shift query param value
 * @returns Canonical shift type or null if invalid (when value is explicitly provided but invalid)
 */
export function parseShiftQueryParam(value: string | null | undefined): CanonicalShiftType | null {
  // If no value provided, default to "Day"
  if (value == null || value === "") {
    return "Day";
  }
  // If value provided, normalize it (returns null if invalid)
  return normalizeShift(value);
}
