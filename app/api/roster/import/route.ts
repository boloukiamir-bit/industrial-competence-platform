/**
 * POST /api/roster/import
 * Import/update roster master data into employee_roster_assignments (org_id + site_id from session).
 * Accepts: JSON { rows: [...] } or multipart/JSON CSV.
 * Maps: anst_id -> employee_anst_id, name -> employee_name; resolves station_id from stations (org, site, code).
 * Idempotent upsert. Tenant-safe; admin/hr only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import Papa from "papaparse";

const supabase = getSupabaseAdmin();

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Canonicalize roster shift to S1/S2/S3; return raw for shift_raw. Unknown values yield shift_code=null. */
function normalizeRosterShiftCode(
  raw: string | null | undefined
): { shift_code: "S1" | "S2" | "S3" | null; shift_raw: string | null } {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { shift_code: null, shift_raw: null };
  const lower = trimmed.toLowerCase();
  const s1 = ["1", "s1", "skift 1", "shift 1", "day"];
  const s2 = ["2", "s2", "skift 2", "shift 2", "evening", "em"];
  const s3 = ["3", "s3", "skift 3", "shift 3", "night", "fm"];
  if (s1.includes(lower)) return { shift_code: "S1", shift_raw: trimmed };
  if (s2.includes(lower)) return { shift_code: "S2", shift_raw: trimmed };
  if (s3.includes(lower)) return { shift_code: "S3", shift_raw: trimmed };
  return { shift_code: null, shift_raw: trimmed };
}

export type RosterRowInput = {
  anst_id?: string;
  name?: string;
  role?: string;
  area?: string;
  station_name?: string;
  station_code?: string;
  legacy_line_id?: string;
  shift_raw?: string;
  shift_code?: string;
  leader_name?: string;
};

function toRosterRow(raw: Record<string, unknown>): RosterRowInput | null {
  const anst_id = typeof raw.anst_id === "string" ? raw.anst_id.trim() : "";
  if (!anst_id) return null;
  return {
    anst_id,
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    role: typeof raw.role === "string" ? raw.role.trim() : "",
    area: typeof raw.area === "string" ? raw.area.trim() : "",
    station_name: typeof raw.station_name === "string" ? raw.station_name.trim() : "",
    station_code: typeof raw.station_code === "string" ? raw.station_code.trim() : "",
    legacy_line_id: typeof raw.legacy_line_id === "string" ? raw.legacy_line_id.trim() : "",
    shift_raw: typeof raw.shift_raw === "string" ? raw.shift_raw.trim() : "",
    shift_code: typeof raw.shift_code === "string" ? raw.shift_code.trim() : "",
    leader_name: typeof raw.leader_name === "string" ? raw.leader_name.trim() : "",
  };
}

async function getRowsFromRequest(request: NextRequest): Promise<RosterRowInput[]> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    const b = body as { rows?: unknown[]; csv?: string };
    if (Array.isArray(b.rows)) {
      return b.rows
        .map((r) => (r && typeof r === "object" ? toRosterRow(r as Record<string, unknown>) : null))
        .filter((r): r is RosterRowInput => r !== null);
    }
    if (typeof b.csv === "string") {
      const parsed = Papa.parse<Record<string, string>>(b.csv, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => normalizeHeader(h),
      });
      return (parsed.data ?? []).map((raw) => toRosterRow(raw as unknown as Record<string, unknown>)).filter((r): r is RosterRowInput => r !== null);
    }
  }
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (file instanceof File) {
      const csvText = await file.text();
      const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => normalizeHeader(h),
      });
      return (parsed.data ?? []).map((raw) => toRosterRow(raw as unknown as Record<string, unknown>)).filter((r): r is RosterRowInput => r !== null);
    }
  }
  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const csvText = await request.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normalizeHeader(h),
    });
    return (parsed.data ?? []).map((raw) => toRosterRow(raw as unknown as Record<string, unknown>)).filter((r): r is RosterRowInput => r !== null);
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const orgId = auth.activeOrgId;
    const siteId = auth.activeSiteId;
    if (!siteId) {
      return NextResponse.json(
        { error: "Active site is required for roster import. Set active_site_id on your profile." },
        { status: 400 }
      );
    }

    const rows = await getRowsFromRequest(request);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows. Send JSON { rows: [...] } with anst_id (and station_code, shift_code, ...) or CSV/file." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const stationMissingCodes = new Set<string>();
    const unmappedShiftCodes = new Set<string>();
    let stationMatches = 0;
    let rowsSkippedDueToShift = 0;

    const { data: areaIds } = await supabase
      .from("areas")
      .select("id")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("is_active", true);
    const areaIdList = (areaIds ?? []).map((a: { id: string }) => a.id);

    const toUpsert: Array<{
      org_id: string;
      site_id: string;
      employee_anst_id: string;
      employee_name: string;
      role: string | null;
      area: string | null;
      station_code: string | null;
      station_name: string | null;
      legacy_line_id: string | null;
      shift_raw: string | null;
      shift_code: string | null;
      leader_name: string | null;
      station_id: string | null;
      updated_at: string;
    }> = [];

    for (const row of rows) {
      const rawShiftInput = row.shift_code?.trim() ?? "";
      const normalized = normalizeRosterShiftCode(row.shift_code);
      if (normalized.shift_code === null) {
        if (rawShiftInput) unmappedShiftCodes.add(rawShiftInput);
        rowsSkippedDueToShift += 1;
        continue;
      }
      const storedShiftRaw = (row.shift_raw?.trim() || row.shift_code?.trim()) || null;

      let stationId: string | null = null;
      if (row.station_code && areaIdList.length > 0) {
        const { data: station } = await supabase
          .from("stations")
          .select("id")
          .eq("org_id", orgId)
          .eq("code", row.station_code)
          .in("area_id", areaIdList)
          .eq("is_active", true)
          .maybeSingle();
        const stationRow = station as { id: string } | null;
        if (stationRow?.id) {
          stationId = stationRow.id;
          stationMatches += 1;
        } else {
          stationMissingCodes.add(row.station_code);
        }
      } else if (row.station_code) {
        stationMissingCodes.add(row.station_code);
      }

      const anstId = row.anst_id ?? "";
      if (!anstId) continue;
      toUpsert.push({
        org_id: orgId,
        site_id: siteId,
        employee_anst_id: anstId,
        employee_name: row.name || anstId,
        role: row.role || null,
        area: row.area || null,
        station_code: row.station_code || null,
        station_name: row.station_name || null,
        legacy_line_id: row.legacy_line_id || null,
        shift_raw: storedShiftRaw,
        shift_code: normalized.shift_code,
        leader_name: row.leader_name || null,
        station_id: stationId,
        updated_at: now,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- employee_roster_assignments may be missing from generated schema
    const { error: upsertError } = await (supabase as any)
      .from("employee_roster_assignments")
      .upsert(toUpsert, {
        onConflict: "org_id,site_id,employee_anst_id,station_code,shift_code",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[roster/import] upsert error:", upsertError);
      return NextResponse.json(
        { ok: false, error: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rows_upserted: toUpsert.length,
      station_matches: stationMatches,
      station_missing_codes: Array.from(stationMissingCodes),
      unmapped_shift_codes: Array.from(unmappedShiftCodes),
      rows_skipped_due_to_shift: rowsSkippedDueToShift,
    });
  } catch (err) {
    console.error("[roster/import]", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Import failed" }, { status: 500 });
  }
}
