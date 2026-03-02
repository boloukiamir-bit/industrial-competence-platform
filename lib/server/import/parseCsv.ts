/**
 * Parse pilot template CSVs (stations + station_operational_requirements).
 * Headers must match docs/import/templates/*.csv exactly (case-sensitive after normalize).
 */

import Papa from "papaparse";

const STATIONS_HEADERS = ["station_code", "station_name", "line", "area", "is_active"] as const;
const REQUIREMENTS_HEADERS = [
  "station_code",
  "required_headcount",
  "required_skill_level",
  "required_senior_count",
] as const;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Normalize station_code: trim; if ends with ".0" remove it. */
export function normalizeStationCode(value: string): string {
  const s = value.trim();
  if (!s) return "";
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) return s.slice(0, -2);
  return s;
}

/** required_headcount: allow decimals; blank => null. */
export function parseRequiredHeadcount(value: string): number | null {
  const s = value?.trim() ?? "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export interface ParsedStationRow {
  station_code: string;
  station_name: string;
  line: string;
  area: string;
  is_active: boolean;
}

export interface ParsedRequirementRow {
  station_code: string;
  required_headcount: number | null;
  required_skill_level: number;
  required_senior_count: number;
}

export interface ParseStationsResult {
  rows: ParsedStationRow[];
  errors: Array<{ row: number; message: string }>;
}

export interface ParseRequirementsResult {
  rows: ParsedRequirementRow[];
  errors: Array<{ row: number; message: string }>;
}

function requireHeaders(csvHeaders: string[], expected: readonly string[]): string | null {
  const normalized = new Set(csvHeaders.map(normalizeHeader));
  for (const h of expected) {
    if (!normalized.has(h.toLowerCase())) return `Missing required column: ${h}`;
  }
  return null;
}

export function parseStationsCsv(csvText: string): ParseStationsResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeHeader(h),
  });
  const rawRows = parsed.data ?? [];
  const errors: Array<{ row: number; message: string }> = [];
  if (rawRows.length > 0) {
    const firstRow = rawRows[0];
    const headers = Object.keys(firstRow);
    const err = requireHeaders(headers, STATIONS_HEADERS);
    if (err) {
      errors.push({ row: 1, message: err });
      return { rows: [], errors };
    }
  }
  const rows: ParsedStationRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const code = normalizeStationCode(raw.station_code ?? "");
    const name = (raw.station_name ?? "").trim();
    const line = (raw.line ?? "").trim();
    const area = (raw.area ?? "").trim();
    const is_active =
      (raw.is_active ?? "true").toLowerCase() !== "false" && (raw.is_active ?? "true").toLowerCase() !== "0";
    if (!code) {
      errors.push({ row: i + 2, message: "station_code is required and must be non-empty after normalize" });
      continue;
    }
    rows.push({
      station_code: code,
      station_name: name || code,
      line: line || code,
      area: area || line || code,
      is_active,
    });
  }
  return { rows, errors };
}

export function parseRequirementsCsv(csvText: string): ParseRequirementsResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeHeader(h),
  });
  const rawRows = parsed.data ?? [];
  const errors: Array<{ row: number; message: string }> = [];
  if (rawRows.length > 0) {
    const firstRow = rawRows[0];
    const headers = Object.keys(firstRow);
    const err = requireHeaders(headers, REQUIREMENTS_HEADERS);
    if (err) {
      errors.push({ row: 1, message: err });
      return { rows: [], errors };
    }
  }
  const rows: ParsedRequirementRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const code = normalizeStationCode(raw.station_code ?? "");
    const headcount = parseRequiredHeadcount(raw.required_headcount ?? "");
    const skillLevelRaw = (raw.required_skill_level ?? "2").trim();
    const skillLevel = Math.min(5, Math.max(0, parseInt(skillLevelRaw, 10) || 2));
    const seniorCountRaw = (raw.required_senior_count ?? "0").trim();
    const seniorCount = Math.max(0, parseInt(seniorCountRaw, 10) || 0);
    if (!code) {
      errors.push({ row: i + 2, message: "station_code is required and must be non-empty after normalize" });
      continue;
    }
    rows.push({
      station_code: code,
      required_headcount: headcount,
      required_skill_level: skillLevel,
      required_senior_count: seniorCount,
    });
  }
  return { rows, errors };
}
