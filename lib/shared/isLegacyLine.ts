/**
 * Legacy/demo line values that must never appear in production UI dropdowns or filters.
 * BEA and legacy demo names (Pressline 1/2, Assembly, Quality Control, etc.) are excluded.
 */
const LEGACY_LINE_VALUES = new Set([
  "BEA",
  "Bearbetning",
  "Pressline 1",
  "Pressline 2",
  "Assembly",
  "Quality Control",
  "Pressline A",
  "Pressline B",
  "Press",
  "QC",
]);

export function isLegacyLine(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const t = value.trim();
  if (!t) return false;
  if (LEGACY_LINE_VALUES.has(t)) return true;
  if (/^BEA$/i.test(t)) return true;
  return false;
}
