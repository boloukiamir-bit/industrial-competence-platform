/**
 * POST /api/onboarding/stations/map — set station.area_id (admin/hr only).
 * Input: { station_id: string, area_id: string }
 * Validates station and area belong to org; updates station.area_id, is_active=true, updated_at=now().
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { station_id?: string; area_id?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const stationId =
    typeof body.station_id === "string" ? body.station_id.trim() || null : null;
  const areaId =
    typeof body.area_id === "string" ? body.area_id.trim() || null : null;

  if (!stationId || !areaId) {
    const res = NextResponse.json(
      { error: "station_id and area_id are required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const [stationRes, areaRes] = await Promise.all([
    supabaseAdmin
      .from("stations")
      .select("id, org_id")
      .eq("id", stationId)
      .maybeSingle(),
    supabaseAdmin
      .from("areas")
      .select("id, org_id")
      .eq("id", areaId)
      .maybeSingle(),
  ]);

  const station = stationRes.data;
  const area = areaRes.data;

  if (stationRes.error || !station) {
    const res = NextResponse.json(
      { error: "Station not found" },
      { status: 404 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (areaRes.error || !area) {
    const res = NextResponse.json(
      { error: "Area not found" },
      { status: 404 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (station.org_id !== auth.activeOrgId) {
    const res = NextResponse.json(
      { error: "Station does not belong to your organization" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (area.org_id !== auth.activeOrgId) {
    const res = NextResponse.json(
      { error: "Area does not belong to your organization" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("stations")
    .update({
      area_id: areaId,
      is_active: true,
      updated_at: now,
    })
    .eq("id", stationId);

  if (updateErr) {
    console.error("[onboarding/stations/map]", updateErr);
    const res = NextResponse.json(
      { error: "Failed to update station" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
