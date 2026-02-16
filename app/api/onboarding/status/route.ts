/**
 * GET /api/onboarding/status — setup status for active org: counts and last bootstrap.
 * Any org member. Used by onboarding page Setup Status block.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export type OnboardingStatusResponse = {
  shift_patterns_count: number;
  areas_count: number;
  stations_mapped_count: number;
  unmapped_stations_count: number;
  last_bootstrap: {
    site_id: string;
    date: string;
    shift_code: string;
    shifts_count: number;
    assignments_count: number;
  } | null;
};

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const session = await getOrgIdFromSession(request, supabase);
  if (!session.success) {
    const res = NextResponse.json({ error: session.error }, { status: session.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = session.orgId;

  const [
    shiftPatternsRes,
    areasRes,
    stationsMappedRes,
    stationsUnmappedRes,
    latestShiftRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("shift_patterns")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
    supabaseAdmin
      .from("areas")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
    supabaseAdmin
      .from("stations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true)
      .not("area_id", "is", null),
    supabaseAdmin
      .from("stations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true)
      .is("area_id", null),
    supabaseAdmin
      .from("shifts")
      .select("id, site_id, shift_date, shift_code")
      .eq("org_id", orgId)
      .not("site_id", "is", null)
      .not("shift_date", "is", null)
      .not("shift_code", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const shift_patterns_count = shiftPatternsRes.count ?? 0;
  const areas_count = areasRes.count ?? 0;
  const stations_mapped_count = stationsMappedRes.count ?? 0;
  const unmapped_stations_count = stationsUnmappedRes.count ?? 0;

  let last_bootstrap: OnboardingStatusResponse["last_bootstrap"] = null;
  const latestShift = latestShiftRes.data;
  if (latestShift?.site_id && latestShift?.shift_date && latestShift?.shift_code) {
    const siteId = latestShift.site_id;
    const date = typeof latestShift.shift_date === "string"
      ? latestShift.shift_date.slice(0, 10)
      : String(latestShift.shift_date).slice(0, 10);
    const shiftCode = latestShift.shift_code;

    const [shiftsInGroupRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("shifts")
        .select("id")
        .eq("org_id", orgId)
        .eq("site_id", siteId)
        .eq("shift_date", date)
        .eq("shift_code", shiftCode),
      supabaseAdmin
        .from("shifts")
        .select("id")
        .eq("org_id", orgId)
        .eq("site_id", siteId)
        .eq("shift_date", date)
        .eq("shift_code", shiftCode),
    ]);

    const shiftIds = (shiftsInGroupRes.data ?? []).map((s) => s.id);
    const shifts_count = shiftIds.length;

    let assignments_count = 0;
    if (shiftIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("shift_assignments")
        .select("id", { count: "exact", head: true })
        .in("shift_id", shiftIds);
      assignments_count = count ?? 0;
    }

    last_bootstrap = {
      site_id: siteId,
      date,
      shift_code: shiftCode,
      shifts_count,
      assignments_count,
    };
  }

  const body: OnboardingStatusResponse = {
    shift_patterns_count,
    areas_count,
    stations_mapped_count,
    unmapped_stations_count,
    last_bootstrap,
  };

  const res = NextResponse.json(body);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
