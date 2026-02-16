/**
 * Normalize dates to ISO date strings (YYYY-MM-DD) for API responses and DB storage.
 * Cockpit and inbox use Europe/Stockholm; date-only values must not be converted via UTC
 * (no new Date(str) then toISOString() for calendar dates — causes off-by-one).
 */

const ISO_DATE_REGEX = /^(\d{4}-\d{2}-\d{2})/;

/** Timezone for cockpit/inbox date display (no UTC shift for date-only values). */
const COCKPIT_TIMEZONE = "Europe/Stockholm";

/**
 * Format a Date as YYYY-MM-DD in Europe/Stockholm so the calendar day matches cockpit selection.
 * Do NOT use toISOString().slice(0,10) — that uses UTC and can be one day earlier in Stockholm.
 */
function dateToISODateInStockholm(d: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: COCKPIT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Convert any value to an ISO date string "YYYY-MM-DD" or null.
 * Use for API responses so clients always get ISO strings.
 * - Date (e.g. from pg date column) -> format in Europe/Stockholm (no UTC shift)
 * - String matching YYYY-MM-DD -> return as-is
 * - Other string (e.g. "Fri Jan 30") -> parse with Date, format in Stockholm or null
 * - null/undefined -> null
 */
export function toISODateString(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return dateToISODateInStockholm(v);
  }
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(ISO_DATE_REGEX);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return dateToISODateInStockholm(d);
}

/**
 * Parse input for DB storage: return YYYY-MM-DD or null.
 * Only accepts strict YYYY-MM-DD (or leading YYYY-MM-DD in string). Pass-through only —
 * no new Date() then toISOString() so the cockpit selected date is persisted exactly.
 */
export function parseDateForStorage(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  if (!s) return null;
  const m = s.match(ISO_DATE_REGEX);
  return m ? m[1] : null;
}

/**
 * Return baseDate + 14 days as YYYY-MM-DD.
 * If baseDateStr is null or invalid, use today as base.
 */
export function addDaysISO(baseDateStr: string | null, days: number): string {
  let base: Date;
  if (baseDateStr && ISO_DATE_REGEX.test(baseDateStr)) {
    base = new Date(baseDateStr + "T12:00:00.000Z");
  } else {
    base = new Date();
  }
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}
