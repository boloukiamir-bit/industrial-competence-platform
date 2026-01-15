import { supabase } from "@/lib/supabaseClient";
import { SPALJISTEN_ORG_ID, ImportResult } from "@/types/spaljisten";

type FailedRow = { line: number; reason: string };

export async function importEmployees(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const employeeId = row["employee_id"]?.trim();
    const employeeName = row["employee_name"]?.trim() || row["name"]?.trim();
    const email = row["email"]?.trim() || null;
    const areaCode = row["area"]?.trim() || row["area_code"]?.trim() || null;

    if (!employeeId) {
      failedRows.push({ line: lineNum, reason: "Missing employee_id" });
      continue;
    }
    if (!employeeName) {
      failedRows.push({ line: lineNum, reason: "Missing employee_name" });
      continue;
    }

    let areaId: string | null = null;
    if (areaCode) {
      const { data: area } = await supabase
        .from("sp_areas")
        .select("id")
        .eq("org_id", orgId)
        .eq("area_code", areaCode)
        .single();
      areaId = area?.id || null;
    }

    const { data: existing } = await supabase
      .from("sp_employees")
      .select("id")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_employees")
        .update({
          employee_name: employeeName,
          email,
          area_id: areaId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_employees").insert({
        org_id: orgId,
        employee_id: employeeId,
        employee_name: employeeName,
        email,
        area_id: areaId,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "employees",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function importSkillsCatalog(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const skillId = row["skill_id"]?.trim();
    const skillName = row["skill_name"]?.trim() || row["name"]?.trim();
    const stationCode = row["station"]?.trim() || row["station_code"]?.trim() || null;
    const category = row["category"]?.trim() || null;

    if (!skillId) {
      failedRows.push({ line: lineNum, reason: "Missing skill_id" });
      continue;
    }
    if (!skillName) {
      failedRows.push({ line: lineNum, reason: "Missing skill_name" });
      continue;
    }

    let stationId: string | null = null;
    if (stationCode) {
      const { data: station } = await supabase
        .from("sp_stations")
        .select("id")
        .eq("org_id", orgId)
        .eq("station_code", stationCode)
        .single();
      stationId = station?.id || null;
    }

    const { data: existing } = await supabase
      .from("sp_skills")
      .select("id")
      .eq("org_id", orgId)
      .eq("skill_id", skillId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_skills")
        .update({
          skill_name: skillName,
          station_id: stationId,
          category,
        })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_skills").insert({
        org_id: orgId,
        skill_id: skillId,
        skill_name: skillName,
        station_id: stationId,
        category,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "skills_catalog",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function importEmployeeSkillRatings(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const employeeId = row["employee_id"]?.trim();
    const skillId = row["skill_id"]?.trim();
    const ratingStr = row["rating"]?.trim();

    if (!employeeId) {
      failedRows.push({ line: lineNum, reason: "Missing employee_id" });
      continue;
    }
    if (!skillId) {
      failedRows.push({ line: lineNum, reason: "Missing skill_id" });
      continue;
    }

    let rating: number | null = null;
    if (ratingStr && ratingStr !== "N" && ratingStr !== "" && ratingStr !== "-") {
      const parsed = parseInt(ratingStr, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 4) {
        failedRows.push({ line: lineNum, reason: `Invalid rating: ${ratingStr}` });
        continue;
      }
      rating = parsed;
    }

    const { data: existing } = await supabase
      .from("sp_employee_skills")
      .select("id")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId)
      .eq("skill_id", skillId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_employee_skills")
        .update({
          rating,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_employee_skills").insert({
        org_id: orgId,
        employee_id: employeeId,
        skill_id: skillId,
        rating,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "employee_skill_ratings",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function importAreas(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const areaCode = row["area_code"]?.trim() || row["code"]?.trim();
    const areaName = row["area_name"]?.trim() || row["name"]?.trim();

    if (!areaCode) {
      failedRows.push({ line: lineNum, reason: "Missing area_code" });
      continue;
    }
    if (!areaName) {
      failedRows.push({ line: lineNum, reason: "Missing area_name" });
      continue;
    }

    const { data: existing } = await supabase
      .from("sp_areas")
      .select("id")
      .eq("org_id", orgId)
      .eq("area_code", areaCode)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_areas")
        .update({ area_name: areaName })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_areas").insert({
        org_id: orgId,
        area_code: areaCode,
        area_name: areaName,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "areas",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function importStations(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const stationCode = row["station_code"]?.trim() || row["code"]?.trim();
    const stationName = row["station_name"]?.trim() || row["name"]?.trim();
    const areaCode = row["area_code"]?.trim() || row["area"]?.trim() || null;

    if (!stationCode) {
      failedRows.push({ line: lineNum, reason: "Missing station_code" });
      continue;
    }
    if (!stationName) {
      failedRows.push({ line: lineNum, reason: "Missing station_name" });
      continue;
    }

    let areaId: string | null = null;
    if (areaCode) {
      const { data: area } = await supabase
        .from("sp_areas")
        .select("id")
        .eq("org_id", orgId)
        .eq("area_code", areaCode)
        .single();
      areaId = area?.id || null;
    }

    const { data: existing } = await supabase
      .from("sp_stations")
      .select("id")
      .eq("org_id", orgId)
      .eq("station_code", stationCode)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_stations")
        .update({
          station_name: stationName,
          area_id: areaId,
        })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_stations").insert({
        org_id: orgId,
        station_code: stationCode,
        station_name: stationName,
        area_id: areaId,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "stations",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function importAreaLeaders(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const areaCode = row["area_code"]?.trim() || row["area"]?.trim();
    const employeeId = row["employee_id"]?.trim() || row["leader_id"]?.trim();
    const isPrimaryStr = row["is_primary"]?.trim() || "false";

    if (!areaCode) {
      failedRows.push({ line: lineNum, reason: "Missing area_code" });
      continue;
    }
    if (!employeeId) {
      failedRows.push({ line: lineNum, reason: "Missing employee_id" });
      continue;
    }

    const { data: area } = await supabase
      .from("sp_areas")
      .select("id")
      .eq("org_id", orgId)
      .eq("area_code", areaCode)
      .single();

    if (!area) {
      failedRows.push({ line: lineNum, reason: `Area not found: ${areaCode}` });
      continue;
    }

    const isPrimary = isPrimaryStr.toLowerCase() === "true" || isPrimaryStr === "1";

    const { data: existing } = await supabase
      .from("sp_area_leaders")
      .select("id")
      .eq("org_id", orgId)
      .eq("area_id", area.id)
      .eq("employee_id", employeeId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_area_leaders")
        .update({ is_primary: isPrimary })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_area_leaders").insert({
        org_id: orgId,
        area_id: area.id,
        employee_id: employeeId,
        is_primary: isPrimary,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "area_leaders",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function importRatingScales(
  rows: Record<string, string>[],
  orgId: string = SPALJISTEN_ORG_ID
): Promise<ImportResult> {
  let inserted = 0;
  let updated = 0;
  const failedRows: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const levelStr = row["level"]?.trim();
    const label = row["label"]?.trim();
    const description = row["description"]?.trim() || null;
    const color = row["color"]?.trim() || null;

    if (!levelStr) {
      failedRows.push({ line: lineNum, reason: "Missing level" });
      continue;
    }
    if (!label) {
      failedRows.push({ line: lineNum, reason: "Missing label" });
      continue;
    }

    const level = parseInt(levelStr, 10);
    if (isNaN(level) || level < 0 || level > 4) {
      failedRows.push({ line: lineNum, reason: `Invalid level: ${levelStr}` });
      continue;
    }

    const { data: existing } = await supabase
      .from("sp_rating_scales")
      .select("id")
      .eq("org_id", orgId)
      .eq("level", level)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("sp_rating_scales")
        .update({ label, description, color })
        .eq("id", existing.id);

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("sp_rating_scales").insert({
        org_id: orgId,
        level,
        label,
        description,
        color,
      });

      if (error) {
        failedRows.push({ line: lineNum, reason: error.message });
      } else {
        inserted++;
      }
    }
  }

  return {
    success: failedRows.length === 0,
    importType: "rating_scales",
    totalRows: rows.length,
    inserted,
    updated,
    failed: failedRows.length,
    failedRows,
  };
}

export async function logImport(
  result: ImportResult,
  fileName: string | null,
  userId: string | null,
  orgId: string = SPALJISTEN_ORG_ID
): Promise<void> {
  await supabase.from("sp_import_logs").insert({
    org_id: orgId,
    import_type: result.importType,
    file_name: fileName,
    total_rows: result.totalRows,
    inserted_count: result.inserted,
    updated_count: result.updated,
    failed_count: result.failed,
    failed_rows: result.failedRows,
    imported_by: userId,
  });
}
