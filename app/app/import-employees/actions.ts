"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgIdForRSC } from "@/lib/server/activeOrgRsc";
import Papa from "papaparse";

/** Aliases for CSV headers (lowercased). First match wins. Spaljisten uses employee_id, employee_name, source_sheet. */
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "employee_name", "namn", "full_name"],
  employee_number: ["employee_number", "employee_id", "employee number", "id", "anställningsnummer"],
  role: ["role", "roll", "title", "job title"],
  line: ["line", "linje", "source_sheet", "area", "area_code", "department"],
  team: ["team", "lag", "shift", "skift"],
  is_active: ["is_active", "active", "aktiv"],
};

interface ImportResult {
  success: boolean;
  message: string;
  count?: number;
}

/** Resolve which CSV header (if any) maps to each key. Uses first alias that exists in headers (lowercased). */
function resolveHeaderMap(headers: string[]): Record<string, string | null> {
  const headerSet = new Set(headers.map((h) => h.trim().toLowerCase()));
  const map: Record<string, string | null> = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const alias = aliases.find((a) => headerSet.has(a));
    map[key] = alias ?? null;
  }
  return map;
}

/** Get normalized value for a key from a raw row using the header map. */
function getValue(row: Record<string, unknown>, headerMap: Record<string, string | null>, key: string): string {
  const header = headerMap[key];
  if (!header) return "";
  const val = row[header];
  return typeof val === "string" ? val.trim() : "";
}

export async function importEmployeesFromCsv(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file") as File | null;

  if (!file) {
    return { success: false, message: "No file provided" };
  }

  const text = await file.text();

  const parseResult = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (parseResult.errors.length > 0) {
    return {
      success: false,
      message: `CSV parsing error: ${parseResult.errors[0].message}`,
    };
  }

  const rows = parseResult.data;

  if (rows.length === 0) {
    return { success: false, message: "CSV file is empty" };
  }

  const headers = Object.keys(rows[0] || {});
  const headerMap = resolveHeaderMap(headers);

  if (!headerMap.name || !headerMap.employee_number) {
    const missing = [
      !headerMap.name && "name (or employee_name, namn)",
      !headerMap.employee_number && "employee_number (or employee_id)",
    ]
      .filter(Boolean)
      .join(", ");
    return {
      success: false,
      message: `Missing required columns: ${missing}. Accepted headers: name/employee_name, employee_number/employee_id; optional: role, line/source_sheet, team, is_active.`,
    };
  }

  const orgId = await getActiveOrgIdForRSC();
  if (!orgId) {
    return { success: false, message: "No active organization selected" };
  }

  const employeesToUpsert: {
    org_id: string;
    name: string;
    employee_number: string;
    role: string;
    line: string;
    team: string;
    is_active: boolean;
  }[] = [];

  for (const row of rows) {
    const name = getValue(row, headerMap, "name");
    const employee_number = getValue(row, headerMap, "employee_number");
    if (!name || !employee_number) continue;

    const role = getValue(row, headerMap, "role");
    const line = getValue(row, headerMap, "line");
    const team = getValue(row, headerMap, "team");
    const isActiveRaw = getValue(row, headerMap, "is_active");

    const isActive =
      isActiveRaw === "" ||
      isActiveRaw.toLowerCase() === "true" ||
      isActiveRaw === "1";

    employeesToUpsert.push({
      org_id: orgId,
      name,
      employee_number,
      role: role || "—",
      line: line || "—",
      team: team || "—",
      is_active: isActive,
    });
  }

  if (employeesToUpsert.length === 0) {
    return { success: false, message: "No valid employee rows found in CSV" };
  }

  const { supabase } = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .upsert(employeesToUpsert, { onConflict: "org_id,employee_number" });

  if (error) {
    return { success: false, message: `Database error: ${error.message}` };
  }

  return {
    success: true,
    message: `Imported ${employeesToUpsert.length} employees`,
    count: employeesToUpsert.length,
  };
}
