/**
 * Shared CSV parsing for onboarding: normalize headers, validate required columns.
 * No DB access; used by preview routes only for parsing/validation.
 */
import Papa from "papaparse";

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export type ParsedCsvResult<T extends Record<string, string> = Record<string, string>> = {
  rows: T[];
  errors: Array<{ rowIndex: number; message: string; code?: string }>;
  missingColumns: string[];
  rawFields: string[] | undefined;
};

/**
 * Parse CSV and validate required columns. Does not perform DB lookups.
 */
export function parseOnboardingCsv<T extends Record<string, string> = Record<string, string>>(
  csvText: string,
  requiredColumns: readonly string[]
): ParsedCsvResult<T> {
  const errors: Array<{ rowIndex: number; message: string; code?: string }> = [];
  const missingColumns: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeHeader(h),
  });

  const rawFields = parsed.meta.fields;
  const rows = (parsed.data ?? []) as T[];

  const required = [...requiredColumns];
  for (const col of required) {
    if (!rawFields?.includes(col)) {
      missingColumns.push(col);
    }
  }

  if (missingColumns.length > 0) {
    errors.push({
      rowIndex: -1,
      message: `Missing required columns: ${missingColumns.join(", ")}`,
      code: "missing_columns",
    });
    return { rows, errors, missingColumns, rawFields };
  }

  return { rows, errors, missingColumns, rawFields };
}

/** Check for duplicate rows by a key (e.g. site_name+area_code). Returns row indices of duplicates (1-based). */
export function findDuplicateRowIndices<T>(
  rows: T[],
  keyFn: (row: T, index: number) => string
): Map<string, number[]> {
  const byKey = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = keyFn(row, i);
    if (!key) return;
    const list = byKey.get(key) ?? [];
    list.push(i + 2);
    byKey.set(key, list);
  });
  const duplicates = new Map<string, number[]>();
  byKey.forEach((indices, key) => {
    if (indices.length > 1) duplicates.set(key, indices);
  });
  return duplicates;
}

/** Parse time string HH:MM or HH:MM:SS; return null if invalid. */
export function parseTime(value: string): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parse integer in range [min, max]; return null if invalid or out of range. */
export function parseIntegerInRange(
  value: string,
  min: number,
  max: number
): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return null;
  if (n < min || n > max) return null;
  return n;
}
