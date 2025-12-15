"use server";

import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse";

interface CsvRow {
  name?: string;
  employee_number?: string;
  role?: string;
  line?: string;
  team?: string;
  is_active?: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  count?: number;
}

export async function importEmployeesFromCsv(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file") as File | null;

  if (!file) {
    return { success: false, message: "No file provided" };
  }

  const text = await file.text();

  const parseResult = Papa.parse<CsvRow>(text, {
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

  const requiredColumns = ["name", "employee_number", "role", "line", "team"];
  const headers = Object.keys(rows[0] || {});
  const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

  if (missingColumns.length > 0) {
    return {
      success: false,
      message: `Missing required columns: ${missingColumns.join(", ")}`,
    };
  }

  const employeesToUpsert: {
    name: string;
    employee_number: string;
    role: string;
    line: string;
    team: string;
    is_active: boolean;
  }[] = [];

  for (const row of rows) {
    if (!row.name || !row.employee_number || !row.role || !row.line || !row.team) {
      continue;
    }

    const isActive =
      row.is_active === undefined ||
      row.is_active === "" ||
      row.is_active.toLowerCase() === "true" ||
      row.is_active === "1";

    employeesToUpsert.push({
      name: row.name.trim(),
      employee_number: row.employee_number.trim(),
      role: row.role.trim(),
      line: row.line.trim(),
      team: row.team.trim(),
      is_active: isActive,
    });
  }

  if (employeesToUpsert.length === 0) {
    return { success: false, message: "No valid employee rows found in CSV" };
  }

  const { error } = await supabase
    .from("employees")
    .upsert(employeesToUpsert, { onConflict: "employee_number" });

  if (error) {
    return { success: false, message: `Database error: ${error.message}` };
  }

  return {
    success: true,
    message: `Imported ${employeesToUpsert.length} employees`,
    count: employeesToUpsert.length,
  };
}
