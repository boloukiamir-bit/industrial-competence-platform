import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Distinct areas from v_cockpit_station_summary for date+shift (cockpit line filter). No legacy line codes. */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim();
    const rawShift = searchParams.get("shift_code") ?? searchParams.get("shift");
    const shift = normalizeShiftParam(rawShift);

    if (!date || !shift) {
      const res = NextResponse.json({ lines: [], source: "v_cockpit_station_summary" });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = supabaseAdmin
      .from("v_cockpit_station_summary")
      .select("area")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date)
      .eq("shift_code", shift);

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/lines] v_cockpit_station_summary error:", error);
      const res = NextResponse.json({ lines: [], source: "v_cockpit_station_summary" });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const raw = [...new Set((rows ?? []).map((r: { area?: string | null }) => r.area).filter((v): v is string => Boolean(v)))];
    const areas = raw.filter((a) => !isLegacyLine(a)).sort();
    const res = NextResponse.json({ lines: areas, source: "v_cockpit_station_summary" });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[cockpit/lines] error:", error);
    return NextResponse.json(
      { error: "Failed to get lines" },
      { status: 500 }
    );
  }
}
