import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";
import { runSeedShifts } from "@/lib/server/seedShifts";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EnsureShiftContextResponse = {
  ok: true;
  success: true;
  date: string;
  shift_code: string;
  line: string;
  created_shift: boolean;
  shifts_created: number;
  shifts_existing: number;
  assignments_created: number;
  assignments_existing: number;
  assignment_count: number;
  shift_ids: string[];
  shift_id: string | null;
  assignment_ids: string[];
};

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const date = parseDate(body.date) ?? parseDate(body.shift_date);
    const rawShift =
      typeof body.shift_code === "string"
        ? body.shift_code
        : typeof body.shift_type === "string"
          ? body.shift_type
          : typeof body.shift === "string"
            ? body.shift
            : null;
    const lineRaw = typeof body.line === "string" ? body.line.trim() : "all";

    if (!date || !rawShift) {
      const res = NextResponse.json(
        { ok: false, error: "date (YYYY-MM-DD) and shift_code are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftCode = normalizeShiftParam(rawShift);
    if (!shiftCode) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter", details: { shift: rawShift } },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!org.activeSiteId) {
      const res = NextResponse.json(
        { ok: false, error: "No active site selected" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const lineFilter = lineRaw && lineRaw !== "all" ? lineRaw : null;

    let result;
    try {
      result = await runSeedShifts(
        supabaseAdmin,
        org.activeOrgId,
        org.activeSiteId,
        date,
        shiftCode,
        { line: lineFilter }
      );
    } catch (err) {
      console.error("[shift-context/ensure] runSeedShifts error:", err);
      const res = NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Seed failed" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!result.ok) {
      const status = result.errorCode === "shift_pattern_missing" ? 404 : 422;
      const res = NextResponse.json(
        {
          ok: false,
          error: result.message,
          errorCode: result.errorCode,
          areas_found: result.areas_found ?? 0,
          stations_found_total: result.stations_found_total ?? 0,
        },
        { status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const createdShift = result.summary.shifts_created > 0;
    const assignmentsCreated = result.summary.assignments_created;
    const assignmentsExisting = result.summary.assignments_existing;

    let areaIds: string[] | null = null;
    if (lineFilter) {
      const { data: areaRows } = await supabaseAdmin
        .from("areas")
        .select("id")
        .eq("org_id", org.activeOrgId)
        .eq("site_id", org.activeSiteId)
        .eq("is_active", true)
        .or(`code.ilike.${lineFilter},name.ilike.${lineFilter}`);
      areaIds = (areaRows ?? []).map((row: { id?: string | null }) => row.id).filter(Boolean) as string[];
    }

    let shiftsQuery = supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", org.activeOrgId)
      .eq("site_id", org.activeSiteId)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode);
    if (areaIds && areaIds.length > 0) {
      shiftsQuery = shiftsQuery.in("area_id", areaIds);
    }
    const { data: shiftRows } = await shiftsQuery;
    const shiftIds = (shiftRows ?? [])
      .map((row: { id?: string | null }) => row.id)
      .filter((id): id is string => Boolean(id));
    const shiftId = shiftIds.length === 1 ? shiftIds[0] : null;
    let assignmentIds: string[] = [];
    if (shiftId) {
      const { data: assignmentRows } = await supabaseAdmin
        .from("shift_assignments")
        .select("id")
        .eq("org_id", org.activeOrgId)
        .eq("shift_id", shiftId);
      assignmentIds = (assignmentRows ?? [])
        .map((row: { id?: string | null }) => row.id)
        .filter((id): id is string => Boolean(id));
    }

    const payload: EnsureShiftContextResponse = {
      ok: true,
      success: true,
      date,
      shift_code: shiftCode,
      line: lineRaw || "all",
      created_shift: createdShift,
      shifts_created: result.summary.shifts_created,
      shifts_existing: result.summary.shifts_existing,
      assignments_created: assignmentsCreated,
      assignments_existing: assignmentsExisting,
      assignment_count: result.summary.assignments_count,
      shift_ids: shiftIds,
      shift_id: shiftId,
      assignment_ids: assignmentIds,
    };

    const res = NextResponse.json(payload);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[shift-context/ensure] error:", error);
    return NextResponse.json(
      { ok: false, error: `Failed to ensure shift context: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
