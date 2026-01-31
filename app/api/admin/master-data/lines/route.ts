/**
 * GET /api/admin/master-data/lines — list lines (pl_lines + any line_code from stations). Admin/hr only.
 * POST /api/admin/master-data/lines — create line. PATCH — update line.
 * Tenant-scoped by active_org_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { getLineName } from "@/lib/lineOverviewLineNames";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Canonical line shape returned by GET */
interface LineRow {
  id: string | null;
  line_code: string;
  line_name: string;
  department_code: string | null;
  leader_employee_id: string | null;
  leader_employee_number: string | null;
  leader_name: string | null;
  is_active: boolean;
  station_count: number;
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    if ("debugHeader" in auth && auth.debugHeader) {
      res.headers.set("x-auth-debug", auth.debugHeader);
    }
    return res;
  }

  const activeOrgId = auth.activeOrgId;
  let lines: LineRow[] = [];
  let metaSource: "pl_lines" | "stations" | "none" = "none";
  let metaError: string | undefined;

  // ──────────────────────────────────────────────────────────────────────────
  // Primary: query pl_lines (safe select — only columns that exist in 007 schema)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: plLines, error: plError } = await supabaseAdmin
    .from("pl_lines")
    .select("id, line_code, line_name, department_code")
    .eq("org_id", activeOrgId)
    .order("line_code");

  if (!plError && plLines && plLines.length > 0) {
    metaSource = "pl_lines";
    // Station counts for enrichment
    const stationCountByLine = await getStationCountByLine(activeOrgId);

    lines = plLines.map((l) => ({
      id: l.id ?? null,
      line_code: l.line_code,
      line_name: l.line_name || getLineName(l.line_code),
      department_code: l.department_code ?? null,
      leader_employee_id: null,
      leader_employee_number: null,
      leader_name: null,
      is_active: true,
      station_count: stationCountByLine[l.line_code] ?? 0,
    }));
  } else {
    // Log if pl_lines query failed (but don't 500)
    if (plError) {
      console.warn("[admin/master-data/lines GET] pl_lines query failed (falling back to stations):", plError.message, plError.code);
      metaError = plError.message;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Fallback: derive lines from stations table
    // ──────────────────────────────────────────────────────────────────────────
    const { data: stationRows, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("line, area_code")
      .eq("org_id", activeOrgId);

    if (stationsError) {
      console.error("[admin/master-data/lines GET] stations fallback query failed:", stationsError.message, stationsError.code);
      metaError = metaError ? `${metaError}; ${stationsError.message}` : stationsError.message;
      // Return empty but valid response — no 500
      const res = NextResponse.json({ lines: [], meta: { source: "none", count: 0, error: metaError } });
      applySupabaseCookies(res, pendingCookies);
      if (auth.debugHeader) res.headers.set("x-auth-debug", auth.debugHeader);
      return res;
    }

    metaSource = "stations";
    const lineCodesSet = new Set<string>();
    const stationCountByLine: Record<string, number> = {};

    for (const s of stationRows || []) {
      // Prefer `line`, fallback to `area_code`
      const code = (s.line ?? s.area_code ?? "").toString().trim();
      if (code) {
        lineCodesSet.add(code);
        stationCountByLine[code] = (stationCountByLine[code] ?? 0) + 1;
      }
    }

    lines = [...lineCodesSet].sort().map((code) => ({
      id: null,
      line_code: code,
      line_name: getLineName(code),
      department_code: code,
      leader_employee_id: null,
      leader_employee_number: null,
      leader_name: null,
      is_active: true,
      station_count: stationCountByLine[code] ?? 0,
    }));
  }

  const res = NextResponse.json({ lines, meta: { source: metaSource, count: lines.length } });
  applySupabaseCookies(res, pendingCookies);
  if (auth.debugHeader) res.headers.set("x-auth-debug", auth.debugHeader);
  return res;
}

/** Helper: get station counts grouped by line code */
async function getStationCountByLine(orgId: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("stations")
    .select("line, area_code")
    .eq("org_id", orgId);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const s of data) {
    const code = (s.line ?? s.area_code ?? "").toString().trim();
    if (code) counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      if ("debugHeader" in auth && auth.debugHeader) {
        res.headers.set("x-auth-debug", auth.debugHeader);
      }
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const line_code = typeof body.line_code === "string" ? body.line_code.trim() : "";
    const line_name = typeof body.line_name === "string" ? body.line_name.trim() : line_code;
    const department_code = typeof body.department_code === "string" ? body.department_code.trim() : line_code;

    if (!line_code) {
      const res = NextResponse.json({ error: "line_code is required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Insert using columns from 007 schema (no is_active / leader_employee_id)
    const { data, error } = await supabaseAdmin
      .from("pl_lines")
      .insert({
        org_id: auth.activeOrgId,
        line_code,
        line_name: line_name || line_code,
        department_code: department_code || line_code,
        updated_at: new Date().toISOString(),
      })
      .select("id, line_code, line_name, department_code")
      .single();

    if (error) {
      if (error.code === "23505") {
        const res = NextResponse.json({ error: "Line code already exists" }, { status: 409 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[admin/master-data/lines POST] insert failed:", error.message, error.code);
      const res = NextResponse.json({ error: error.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(data);
    applySupabaseCookies(res, pendingCookies);
    if (auth.debugHeader) {
      res.headers.set("x-auth-debug", auth.debugHeader);
    }
    return res;
  } catch (err) {
    console.error("[admin/master-data/lines POST]", err);
    return NextResponse.json({ error: "Failed to create line" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      if ("debugHeader" in auth && auth.debugHeader) {
        res.headers.set("x-auth-debug", auth.debugHeader);
      }
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const id = body.id ?? request.nextUrl.searchParams.get("id");
    if (!id) {
      const res = NextResponse.json({ error: "id is required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Only update columns that exist in 007 schema
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.line_name === "string") updates.line_name = body.line_name.trim();
    if (typeof body.department_code === "string") updates.department_code = body.department_code.trim();
    if (typeof body.notes === "string") updates.notes = body.notes;

    const { data, error } = await supabaseAdmin
      .from("pl_lines")
      .update(updates)
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .select("id, line_code, line_name, department_code")
      .single();

    if (error) {
      console.error("[admin/master-data/lines PATCH] update failed:", error.message, error.code);
      const res = NextResponse.json({ error: error.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json({ error: "Line not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(data);
    applySupabaseCookies(res, pendingCookies);
    if (auth.debugHeader) {
      res.headers.set("x-auth-debug", auth.debugHeader);
    }
    return res;
  } catch (err) {
    console.error("[admin/master-data/lines PATCH]", err);
    return NextResponse.json({ error: "Failed to update line" }, { status: 500 });
  }
}
