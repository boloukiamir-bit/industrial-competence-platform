/**
 * GET /api/admin/master-data/lines — list lines from canonical source (public.stations). Admin/hr only.
 * POST/PATCH — create/update line as placeholder station row in public.stations. No writes to pl_lines.
 * Tenant-scoped by active_org_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { getActiveLines } from "@/lib/server/getActiveLines";
import { getLineName } from "@/lib/lineOverviewLineNames";
import { lineToStationPayload } from "@/lib/server/lineToStation";

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
  try {
    const lineCodes = await getActiveLines(activeOrgId);
    const stationCountByLine = await getStationCountByLine(activeOrgId);
    const { data: placeholderStations } = await supabaseAdmin
      .from("stations")
      .select("id, line")
      .eq("org_id", activeOrgId)
      .like("code", "LINE-%");
    const idByLine = new Map<string, string>();
    for (const s of placeholderStations ?? []) {
      if (s.line) idByLine.set(String(s.line).trim(), s.id);
    }
    lines = lineCodes.map((code) => ({
      id: idByLine.get(code) ?? null,
      line_code: code,
      line_name: getLineName(code),
      department_code: code,
      leader_employee_id: null,
      leader_employee_number: null,
      leader_name: null,
      is_active: true,
      station_count: stationCountByLine[code] ?? 0,
    }));
  } catch (err) {
    console.error("[admin/master-data/lines GET] getActiveLines failed:", err);
    const res = NextResponse.json({ lines: [], meta: { source: "stations", count: 0, error: err instanceof Error ? err.message : "Failed to load lines" } });
    applySupabaseCookies(res, pendingCookies);
    if (auth.debugHeader) res.headers.set("x-auth-debug", auth.debugHeader);
    return res;
  }

  const res = NextResponse.json({ lines, meta: { source: "stations", count: lines.length } });
  applySupabaseCookies(res, pendingCookies);
  if (auth.debugHeader) res.headers.set("x-auth-debug", auth.debugHeader);
  return res;
}

/** Helper: get station counts grouped by line (active stations only, matches getActiveLines) */
async function getStationCountByLine(orgId: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("stations")
    .select("line")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .not("line", "is", null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const s of data) {
    const code = (s.line ?? "").toString().trim();
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
    const is_active = body.is_active !== false;

    if (!line_code) {
      const res = NextResponse.json({ error: "line_code is required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const payload = lineToStationPayload(auth.activeOrgId, line_code, line_name || line_code, is_active);
    const { data, error } = await supabaseAdmin
      .from("stations")
      .upsert(payload, { onConflict: "org_id,area_code,code" })
      .select("id, line, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        const res = NextResponse.json({ error: "Line code already exists" }, { status: 409 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[admin/master-data/lines POST] stations upsert failed:", error.message, error.code);
      const res = NextResponse.json({ error: error.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      id: data?.id ?? null,
      line_code: data?.line ?? line_code,
      line_name: (data?.name ?? "").replace(/\s*\(LINE\)\s*$/, "") || line_code,
      department_code: line_code,
    });
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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.line_name === "string") {
      const name = body.line_name.trim();
      if (name) updates.name = `${name} (LINE)`;
    }
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from("stations")
      .update(updates)
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .like("code", "LINE-%")
      .select("id, line, name, is_active")
      .single();

    if (error) {
      console.error("[admin/master-data/lines PATCH] stations update failed:", error.message, error.code);
      const res = NextResponse.json({ error: error.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json({ error: "Line not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      id: data.id,
      line_code: data.line,
      line_name: (data.name ?? "").replace(/\s*\(LINE\)\s*$/, ""),
      department_code: data.line,
      is_active: data.is_active,
    });
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
