/**
 * Net working time: gross segment minutes * net_factor.
 * net_factor = (gross_shift - break_minutes + paid_break_minutes) / gross_shift.
 * AssignedHours uses net to avoid Over-assigned when 07-16 has 60 min break (8h net, not 9h).
 */

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Gross minutes for a segment. Handles overnight (end < start). */
export function segmentGrossMinutes(startTime: string, endTime: string): number {
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  if (e <= s) return 24 * 60 - s + e; // overnight
  return e - s;
}

/** Gross hours for a segment (same basis as created segment duration). */
export function segmentGrossHours(startTime: string, endTime: string): number {
  return segmentGrossMinutes(startTime, endTime) / 60;
}

/** Add decimal hours to a time string "HH:MM". Handles overnight (wraps at 24h). */
export function addHoursToTime(time: string, hours: number): string {
  const totalMinutes = timeToMinutes(time) + hours * 60;
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Gross shift minutes from shift_start/end. Handles overnight (e.g. Night 22:00-06:00). */
function shiftGrossMinutes(shiftStart: string, shiftEnd: string): number {
  const s = timeToMinutes(shiftStart);
  const e = timeToMinutes(shiftEnd);
  if (e <= s) return 24 * 60 - s + e;
  return e - s;
}

export type ShiftRule = {
  shift_start: string;
  shift_end: string;
  break_minutes: number;
  paid_break_minutes: number;
};

/** net_factor = net_shift_minutes / gross_shift_minutes. If no rule or gross=0, 1. */
export function computeNetFactor(rule: ShiftRule | null): number {
  if (!rule) return 1;
  const gross = shiftGrossMinutes(rule.shift_start, rule.shift_end);
  if (gross <= 0) return 1;
  const net = gross - (rule.break_minutes ?? 0) + (rule.paid_break_minutes ?? 0);
  return Math.max(0, Math.min(1, net / gross));
}

/** Net hours for a segment: gross_minutes * net_factor / 60. */
export function segmentNetHours(
  startTime: string,
  endTime: string,
  netFactor: number
): number {
  const grossMinutes = segmentGrossMinutes(startTime, endTime);
  return (grossMinutes * netFactor) / 60;
}

/** True if [s1,e1] and [s2,e2] overlap. Handles overnight (e.g. 22:00–06:00). */
export function timeRangesOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string
): boolean {
  const toM = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const norm = (s: number, e: number): [number, number][] =>
    e > s ? [[s, e]] : [[s, 24 * 60], [0, e]];
  const r1 = norm(toM(s1), toM(e1));
  const r2 = norm(toM(s2), toM(e2));
  for (const [a, b] of r1)
    for (const [c, d] of r2)
      if (a < d && c < b) return true;
  return false;
}
