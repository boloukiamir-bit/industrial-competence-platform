/**
 * RFC 4180 CSV field escaping for export.
 * If field contains comma, newline, or double-quote, wrap in quotes and escape internal " as "".
 */
export function escapeCsvField(value: string | null | undefined): string {
  const s = value == null ? "" : String(value);
  const needsQuotes = /[,\n"]/.test(s);
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}
