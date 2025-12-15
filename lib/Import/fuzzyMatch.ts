import { distance } from "fastest-levenshtein";

export const fuzzyMatch = (input: string, existing: string[]): string => {
  let best = input;
  let minDist = Infinity;

  for (const e of existing) {
    const d = distance(input.toLowerCase(), e.toLowerCase());
    const ratio = d / Math.max(input.length, e.length);

    if (ratio <= 0.25 && d < minDist) {
      minDist = d;
      best = e;
    }
  }

  return best;
};
