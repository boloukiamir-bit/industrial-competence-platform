/**
 * POST /api/admin/import/stations — idempotent UPSERT of pilot station templates.
 * Body: { stationsCsv: string, requirementsCsv: string, dryRun?: boolean }
 * Auth: admin/hr only. Scoped by active_org_id. No other imports.
 *
 * Stations UPSERT key: (org_id, area_code, code) — matches constraint stations_org_id_area_code_code_key.
 * Requirements UPSERT key: (org_id, station_code). All station_code values are normalized before use.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { parseStationsCsv, parseRequirementsCsv } from "@/lib/server/import/parseCsv";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Real schema: unique (org_id, area_code, code). Must stay in sync with stations table. */
const STATIONS_REQUIRED_COLUMNS =
  "id, org_id, code, area_code, line, name, is_active, updated_at" as const;
const REQUIREMENTS_REQUIRED_COLUMNS =
  "id, org_id, station_code, required_headcount, required_skill_level, required_senior_count, updated_at" as const;

export interface ImportStationsResponse {
  ok: boolean;
  stations?: { inserted: number; updated: number; duplicatesSkipped?: number };
  requirements?: { inserted: number; updated: number; duplicatesSkipped?: number };
  dryRun?: {
    stations: { wouldInsert: number; wouldUpdate: number; duplicatesSkipped: number };
    requirements: { wouldInsert: number; wouldUpdate: number; duplicatesSkipped: number };
  };
  errors?: Array<{ row?: number; message: string }>;
}

/** Assert stations and station_operational_requirements have expected columns; return error message or null. */
async function assertStationsSchema(): Promise<string | null> {
  const { error: stationsError } = await supabaseAdmin
    .from("stations")
    .select(STATIONS_REQUIRED_COLUMNS)
    .limit(0);
  if (stationsError) {
    return `Stations schema mismatch: expected columns ${STATIONS_REQUIRED_COLUMNS}. ${stationsError.message}`;
  }
  const { error: reqError } = await supabaseAdmin
    .from("station_operational_requirements")
    .select(REQUIREMENTS_REQUIRED_COLUMNS)
    .limit(0);
  if (reqError) {
    return `station_operational_requirements schema mismatch: expected columns ${REQUIREMENTS_REQUIRED_COLUMNS}. ${reqError.message}`;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({})) as {
      stationsCsv?: string;
      requirementsCsv?: string;
      dryRun?: boolean;
    };
    const stationsCsv = typeof body.stationsCsv === "string" ? body.stationsCsv : "";
    const requirementsCsv = typeof body.requirementsCsv === "string" ? body.requirementsCsv : "";
    const dryRun = body.dryRun === true;

    const errors: Array<{ row?: number; message: string }> = [];
    if (!stationsCsv.trim()) errors.push({ message: "stationsCsv is required" });
    if (!requirementsCsv.trim()) errors.push({ message: "requirementsCsv is required" });
    if (errors.length > 0) {
      const res = NextResponse.json({ ok: false, errors }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stationResult = parseStationsCsv(stationsCsv);
    const requirementsResult = parseRequirementsCsv(requirementsCsv);
    errors.push(...stationResult.errors.map((e) => ({ row: e.row, message: `stations: ${e.message}` })));
    errors.push(...requirementsResult.errors.map((e) => ({ row: e.row, message: `requirements: ${e.message}` })));

    const orgId = auth.activeOrgId;

    const schemaErr = await assertStationsSchema();
    if (schemaErr) {
      const res = NextResponse.json(
        { ok: false, error: schemaErr, code: "SCHEMA_MISMATCH" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const dedupeStations = (): { rows: typeof stationResult.rows; duplicatesSkipped: number } => {
      const seen = new Set<string>();
      const rows: typeof stationResult.rows = [];
      let duplicatesSkipped = 0;
      for (const row of stationResult.rows) {
        const area_code = (row.area || row.line || row.station_code).trim() || row.station_code;
        const key = `${area_code}\t${row.station_code}`;
        if (seen.has(key)) {
          duplicatesSkipped++;
          continue;
        }
        seen.add(key);
        rows.push(row);
      }
      return { rows, duplicatesSkipped };
    };
    const dedupeRequirements = (): { rows: typeof requirementsResult.rows; duplicatesSkipped: number } => {
      const seen = new Set<string>();
      const rows: typeof requirementsResult.rows = [];
      let duplicatesSkipped = 0;
      for (const row of requirementsResult.rows) {
        if (seen.has(row.station_code)) {
          duplicatesSkipped++;
          continue;
        }
        seen.add(row.station_code);
        rows.push(row);
      }
      return { rows, duplicatesSkipped };
    };

    const { rows: stationRows, duplicatesSkipped: stationsDuplicatesSkipped } = dedupeStations();
    const { rows: requirementRows, duplicatesSkipped: requirementsDuplicatesSkipped } = dedupeRequirements();

    let stationsInserted = 0;
    let stationsUpdated = 0;
    let requirementsInserted = 0;
    let requirementsUpdated = 0;

    if (!dryRun) {
      for (const row of stationRows) {
        const area_code = (row.area || row.line || row.station_code).trim() || row.station_code;
        const payload = {
          org_id: orgId,
          code: row.station_code,
          name: row.station_name,
          area_code,
          line: area_code,
          is_active: row.is_active,
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabaseAdmin
          .from("stations")
          .select("id")
          .eq("org_id", orgId)
          .eq("area_code", area_code)
          .eq("code", row.station_code)
          .maybeSingle();
        if (existing) {
          const { error: upErr } = await supabaseAdmin.from("stations").update(payload).eq("id", existing.id);
          if (upErr) errors.push({ message: `stations row ${row.station_code}: ${upErr.message}` });
          else stationsUpdated++;
        } else {
          const { error: insErr } = await supabaseAdmin.from("stations").insert(payload);
          if (insErr) errors.push({ message: `stations row ${row.station_code}: ${insErr.message}` });
          else stationsInserted++;
        }
      }

      for (const row of requirementRows) {
        const payload = {
          org_id: orgId,
          station_code: row.station_code,
          required_headcount: row.required_headcount,
          required_skill_level: row.required_skill_level,
          required_senior_count: row.required_senior_count,
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabaseAdmin
          .from("station_operational_requirements")
          .select("id")
          .eq("org_id", orgId)
          .eq("station_code", row.station_code)
          .maybeSingle();
        if (existing) {
          const { error: upErr } = await supabaseAdmin
            .from("station_operational_requirements")
            .update(payload)
            .eq("id", existing.id);
          if (upErr) errors.push({ message: `requirements row ${row.station_code}: ${upErr.message}` });
          else requirementsUpdated++;
        } else {
          const { error: insErr } = await supabaseAdmin.from("station_operational_requirements").insert(payload);
          if (insErr) errors.push({ message: `requirements row ${row.station_code}: ${insErr.message}` });
          else requirementsInserted++;
        }
      }
    } else {
      for (const row of stationRows) {
        const area_code = (row.area || row.line || row.station_code).trim() || row.station_code;
        const { data: existing } = await supabaseAdmin
          .from("stations")
          .select("id")
          .eq("org_id", orgId)
          .eq("area_code", area_code)
          .eq("code", row.station_code)
          .maybeSingle();
        if (existing) stationsUpdated++;
        else stationsInserted++;
      }
      for (const row of requirementRows) {
        const { data: existing } = await supabaseAdmin
          .from("station_operational_requirements")
          .select("id")
          .eq("org_id", orgId)
          .eq("station_code", row.station_code)
          .maybeSingle();
        if (existing) requirementsUpdated++;
        else requirementsInserted++;
      }
    }

    const res = NextResponse.json({
      ok: true,
      stations: {
        inserted: stationsInserted,
        updated: stationsUpdated,
        ...(stationsDuplicatesSkipped > 0 ? { duplicatesSkipped: stationsDuplicatesSkipped } : {}),
      },
      requirements: {
        inserted: requirementsInserted,
        updated: requirementsUpdated,
        ...(requirementsDuplicatesSkipped > 0 ? { duplicatesSkipped: requirementsDuplicatesSkipped } : {}),
      },
      ...(dryRun
        ? {
            dryRun: {
              stations: {
                wouldInsert: stationsInserted,
                wouldUpdate: stationsUpdated,
                duplicatesSkipped: stationsDuplicatesSkipped,
              },
              requirements: {
                wouldInsert: requirementsInserted,
                wouldUpdate: requirementsUpdated,
                duplicatesSkipped: requirementsDuplicatesSkipped,
              },
            },
          }
        : {}),
      ...(errors.length > 0 ? { errors } : {}),
    } satisfies ImportStationsResponse);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/import/stations]", err);
    return NextResponse.json({ ok: false, error: "Import failed" }, { status: 500 });
  }
}
