/**
 * Server-side mapping: line_code -> Swedish display name (Spaljisten org chart).
 * BEA=Bearbetning, OMM=Ommantling, PAC=Packen, LOG=Logistik, UND=Underhåll.
 * Can be replaced by areas table lookup when available.
 */
export const LINE_CODE_TO_NAME: Record<string, string> = {
  BEA: "Bearbetning",
  OMM: "Ommantling",
  PAC: "Packen",
  LOG: "Logistik",
  UND: "Underhåll",
};

/** Reverse: Swedish name -> line code. Used to normalize employee.line for filtering. */
export const LINE_NAME_TO_CODE: Record<string, string> = {
  Bearbetning: "BEA",
  Ommantling: "OMM",
  Packen: "PAC",
  Logistik: "LOG",
  Underhåll: "UND",
};

const CANONICAL_LINE_CODES = new Set<string>(["BEA", "OMM", "PAC", "LOG", "UND"]);

/** Case-insensitive lookup: normalized name -> code */
const LINE_NAME_LOWER_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(LINE_NAME_TO_CODE).map(([name, code]) => [name.toLowerCase(), code])
);

/**
 * Normalize employee.line to canonical line_code for filtering.
 * - If value is already a line code (BEA/OMM/PAC/LOG/UND), return it (uppercase).
 * - If value is a Swedish name (Bearbetning, Packen, etc.), return the code.
 * - Case and trim safe. Does not break tenants that already store line codes.
 */
export function normalizeEmployeeLineToCode(employeeLine: string | null | undefined): string {
  const raw = (employeeLine ?? "").toString().trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (CANONICAL_LINE_CODES.has(upper)) return upper;
  const byName = LINE_NAME_TO_CODE[raw] ?? LINE_NAME_LOWER_TO_CODE[raw.toLowerCase()];
  if (byName) return byName;
  return raw;
}

/**
 * Map line code to DB line name (shifts.line uses Swedish names).
 * BEA -> Bearbetning, Bearbetning -> Bearbetning (pass-through).
 * Use before shift lookup when line comes from stations or payload.
 */
export function getLineName(lineCode: string): string {
  const raw = (lineCode ?? "").toString().trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  return LINE_CODE_TO_NAME[upper] ?? raw;
}
