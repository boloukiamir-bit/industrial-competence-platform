/**
 * Decision Cost Engine v1 — UI-only heuristic ranges by severity.
 * Shared by Decision impact block and Decision Cost Summary. No backend.
 */
export const COST_ENGINE = {
  BLOCKING: { costMin: 5_000, costMax: 15_000, hoursMin: 4, hoursMax: 12 },
  WARNING: { costMin: 1_000, costMax: 5_000, hoursMin: 1, hoursMax: 4 },
} as const;

export function formatSekRange(min: number, max: number): string {
  return `${(min / 1000).toFixed(0)}–${(max / 1000).toFixed(0)} k SEK`;
}

export function costMidpoint(severity: "BLOCKING" | "WARNING"): number {
  const r = COST_ENGINE[severity];
  return (r.costMin + r.costMax) / 2;
}

export function hoursMidpoint(severity: "BLOCKING" | "WARNING"): number {
  const r = COST_ENGINE[severity];
  return (r.hoursMin + r.hoursMax) / 2;
}

/** Aggregate lower/upper bounds for cost and time across severities. */
export function aggregateRanges(severities: Array<"BLOCKING" | "WARNING">): {
  costMin: number;
  costMax: number;
  hoursMin: number;
  hoursMax: number;
} {
  let costMin = 0, costMax = 0, hoursMin = 0, hoursMax = 0;
  for (const s of severities) {
    const r = COST_ENGINE[s];
    costMin += r.costMin;
    costMax += r.costMax;
    hoursMin += r.hoursMin;
    hoursMax += r.hoursMax;
  }
  return { costMin, costMax, hoursMin, hoursMax };
}

export function formatHoursRange(min: number, max: number): string {
  return `${min}–${max} op·h`;
}

export const FRAGILITY_PTS = { BLOCKING: 25, WARNING: 8 } as const;
