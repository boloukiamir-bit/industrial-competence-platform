/**
 * Client helpers for Cockpit URL/params and date selection.
 * API params: date, shift_code, optional line, optional show_resolved=1.
 */

export function cockpitSummaryParams(opts: {
  date: string;
  shift_code: string;
  line?: string;
  show_resolved?: boolean;
}): URLSearchParams {
  const p = new URLSearchParams();
  p.set("date", opts.date);
  p.set("shift_code", opts.shift_code);
  if (opts.line && opts.line !== "all") p.set("line", opts.line);
  if (opts.show_resolved) p.set("show_resolved", "1");
  return p;
}

/** YYYY-MM-DD for a date N days before the given date (string YYYY-MM-DD). */
export function dateDaysAgo(dateStr: string, daysAgo: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
