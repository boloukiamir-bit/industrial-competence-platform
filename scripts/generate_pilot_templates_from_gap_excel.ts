#!/usr/bin/env node
/**
 * One-time generator: pilot "golden" CSV templates from Gap Excel.
 * No DB writes. Outputs to docs/import/templates/.
 *
 * Usage:
 *   npm run gen:pilot-templates
 *   GAP_EXCEL_PATH=/mnt/data/Gap\ analys\ medarbetarutveckling\ 2026.xlsx npm run gen:pilot-templates
 *
 * Default input: ./data/gap_analys_2026.xlsx
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TYP_A_SHEETS = ["Ommantling", "Packen", "Logistik"] as const;
const PLACEHOLDER_SHEETS = ["Bearbetning", "Underhåll"] as const;
const OUT_DIR = join(__dirname, "..", "docs", "import", "templates");
const DEFAULT_INPUT = join(__dirname, "..", "data", "gap_analys_2026.xlsx");

interface StationRow {
  station_code: string;
  station_name: string;
  line: string;
  area: string;
  is_active: boolean;
}

interface RequirementRow {
  station_code: string;
  required_headcount: number | "";
  required_skill_level: number;
  required_senior_count: number;
}

function getInputPath(): string {
  const env = process.env.GAP_EXCEL_PATH?.trim();
  if (env) return env;
  return DEFAULT_INPUT;
}

function normalizeStationCode(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) return s.slice(0, -2);
  return s;
}

function isNumeric(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return !Number.isNaN(value);
  const s = String(value).trim();
  if (!s) return false;
  const n = Number(s);
  return !Number.isNaN(n);
}

function toNum(value: unknown): number | "" {
  if (value == null || value === "") return "";
  if (typeof value === "number") return Number.isNaN(value) ? "" : value;
  const n = Number(String(value).trim());
  return Number.isNaN(n) ? "" : n;
}

function nonEmptyStr(value: unknown): string {
  const s = value != null ? String(value).trim() : "";
  return s;
}

/** Escape a CSV field (quote if contains comma, newline, or double quote). */
function csvEscape(val: string | number | boolean): string {
  const s = String(val);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(path: string, headers: string[], rows: (string | number | boolean)[][]): void {
  const lines: string[] = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path, lines.join("\n"), "utf-8");
}

function readFirstThreeColumns(sheet: XLSX.WorkSheet): unknown[][] {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return data.map((row) => {
    const a = Array.isArray(row) ? row : [];
    return [a[0], a[1], a[2]];
  });
}

function main(): void {
  const inputPath = getInputPath();
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error("Place the Gap Excel at ./data/gap_analys_2026.xlsx or set GAP_EXCEL_PATH.");
    process.exit(1);
  }

  const buf = readFileSync(inputPath);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetNames = workbook.SheetNames;

  const seenCodes = new Set<string>();
  const duplicateCodes: string[] = [];
  const stations: StationRow[] = [];
  const requirements: RequirementRow[] = [];
  let placeholdersCount = 0;

  for (const sheetName of TYP_A_SHEETS) {
    if (!sheetNames.includes(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const rows = readFirstThreeColumns(sheet);
    for (let i = 0; i < rows.length; i++) {
      const [col0, col1, col2] = rows[i];
      const headcount = toNum(col0);
      const codeRaw = col1;
      const name = nonEmptyStr(col2);
      if (!isNumeric(codeRaw) || !name) continue;
      const station_code = normalizeStationCode(codeRaw);
      if (!station_code) continue;
      if (seenCodes.has(station_code)) {
        duplicateCodes.push(`${sheetName}:${station_code}`);
        continue;
      }
      seenCodes.add(station_code);
      const headcountNum = typeof headcount === "number" ? headcount : 0;
      stations.push({
        station_code,
        station_name: name,
        line: sheetName,
        area: sheetName,
        is_active: true,
      });
      requirements.push({
        station_code,
        required_headcount: headcountNum,
        required_skill_level: 2,
        required_senior_count: 0,
      });
    }
  }

  console.warn("Manual completion needed for sheets: Bearbetning, Underhåll");
  for (const sheetName of PLACEHOLDER_SHEETS) {
    if (!sheetNames.includes(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const rows = readFirstThreeColumns(sheet);
    for (let i = 0; i < rows.length; i++) {
      const [col0, col1, col2] = rows[i];
      if (!isNumeric(col2)) continue;
      const name = nonEmptyStr(col1);
      const headcount = toNum(col0);
      if (name !== "" || headcount !== "") continue;
      const station_code = normalizeStationCode(col2);
      if (!station_code) continue;
      if (seenCodes.has(station_code)) {
        duplicateCodes.push(`${sheetName}:${station_code}`);
        continue;
      }
      seenCodes.add(station_code);
      placeholdersCount += 1;
      stations.push({
        station_code,
        station_name: "(MISSING_NAME)",
        line: sheetName,
        area: sheetName,
        is_active: true,
      });
      requirements.push({
        station_code,
        required_headcount: "",
        required_skill_level: 2,
        required_senior_count: 0,
      });
    }
  }

  if (duplicateCodes.length > 0) {
    console.warn("Duplicate station_code (first occurrence kept):", duplicateCodes.join(", "));
  }

  const stationsPath = join(OUT_DIR, "stations.csv");
  writeCsv(stationsPath, ["station_code", "station_name", "line", "area", "is_active"], [
    ...stations.map((r) => [r.station_code, r.station_name, r.line, r.area, r.is_active]),
  ]);
  console.log(`Wrote ${stations.length} rows to ${stationsPath}`);

  const reqPath = join(OUT_DIR, "station_operational_requirements.csv");
  writeCsv(reqPath, ["station_code", "required_headcount", "required_skill_level", "required_senior_count"], [
    ...requirements.map((r) => [
      r.station_code,
      r.required_headcount === "" ? "" : r.required_headcount,
      r.required_skill_level,
      r.required_senior_count,
    ]),
  ]);
  console.log(`Wrote ${requirements.length} rows to ${reqPath}`);

  console.log("---");
  console.log(`Total stations written: ${stations.length}`);
  console.log(`Duplicates skipped: ${duplicateCodes.length}`);
  console.log(`Placeholders (MISSING_NAME + blank headcount): ${placeholdersCount}`);
}

main();
