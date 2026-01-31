/**
 * GET /api/admin/master-data/stations — list stations by line. Admin/hr only.
 * POST — create station. PATCH — update station.
 * Tenant-scoped by active_org_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: rows, error } = await supabaseAdmin
      .from("stations")
      .select("id, name, code, line, is_active, created_at, updated_at")
      .eq("org_id", auth.activeOrgId)
      .order("line")
      .order("name");

    if (error) {
      const res = NextResponse.json({ error: "Failed to fetch stations" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stations = (rows || []).map((s: { id: string; name: string | null; code: string | null; line: string | null; is_active: boolean }) => ({
      id: s.id,
      station_code: s.code ?? "",
      station_name: s.name ?? "",
      line_code: s.line ?? "",
      is_active: s.is_active,
    }));

    const res = NextResponse.json({ stations });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/stations GET]", err);
    return NextResponse.json({ error: "Failed to load stations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const line_code = typeof body.line_code === "string" ? body.line_code.trim() : "";
    const station_code = typeof body.station_code === "string" ? body.station_code.trim() : "";
    const station_name = typeof body.station_name === "string" ? body.station_name.trim() : station_code;
    const is_active = body.is_active !== false;

    if (!line_code || !station_code) {
      const res = NextResponse.json({ error: "line_code and station_code are required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("stations")
      .insert({
        org_id: auth.activeOrgId,
        name: station_name || station_code,
        code: station_code,
        line: line_code,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .select("id, name, code, line, is_active")
      .single();

    if (error) {
      const res = NextResponse.json({ error: error.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      id: data.id,
      station_code: data.code,
      station_name: data.name,
      line_code: data.line,
      is_active: data.is_active,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/stations POST]", err);
    return NextResponse.json({ error: "Failed to create station" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
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
    if (typeof body.station_name === "string") updates.name = body.station_name.trim();
    if (typeof body.station_code === "string") updates.code = body.station_code.trim();
    if (typeof body.line_code === "string") updates.line = body.line_code.trim();
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from("stations")
      .update(updates)
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .select("id, name, code, line, is_active")
      .single();

    if (error) {
      const res = NextResponse.json({ error: error.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json({ error: "Station not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      id: data.id,
      station_code: data.code,
      station_name: data.name,
      line_code: data.line,
      is_active: data.is_active,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/stations PATCH]", err);
    return NextResponse.json({ error: "Failed to update station" }, { status: 500 });
  }
}
