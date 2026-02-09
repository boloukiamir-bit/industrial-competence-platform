import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type DrilldownRow = {
  org_id: string;
  site_id: string | null;
  shift_code: string;
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  area: string | null;
  employee_anst_id: string;
  actual_level: number | null;
  status: "NO_GO" | "WARNING" | "GO";
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { stationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const shiftCode =
      searchParams.get("shift_code") || searchParams.get("shift")?.trim() || undefined;

    if (!stationId) {
      const res = NextResponse.json(
        { ok: false, error: "stationId is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!shiftCode) {
      const res = NextResponse.json(
        { ok: false, error: "shift_code is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = supabaseAdmin
      .from("v_roster_station_shift_drilldown_pilot")
      .select("*")
      .eq("org_id", org.activeOrgId)
      .eq("shift_code", shiftCode)
      .eq("station_id", stationId);

    if (org.activeSiteId) {
      query = query.eq("site_id", org.activeSiteId);
    } else {
      query = query.is("site_id", null);
    }

    const { data: rows, error } = await query
      .order("status", { ascending: false })
      .order("actual_level", { ascending: true, nullsFirst: true })
      .order("employee_anst_id", { ascending: true });

    if (error) {
      console.error("[cockpit/issues/drilldown] query error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch drilldown" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const drilldown = (rows || []) as DrilldownRow[];
    const ordered = [...drilldown].sort((a, b) => {
      const rank = (s: string) => (s === "NO_GO" ? 1 : s === "WARNING" ? 2 : 3);
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      const al = a.actual_level ?? -1;
      const bl = b.actual_level ?? -1;
      return al - bl;
    });

    const res = NextResponse.json({
      ok: true,
      drilldown: ordered,
      station: drilldown[0]
        ? {
            station_id: drilldown[0].station_id,
            station_code: drilldown[0].station_code,
            station_name: drilldown[0].station_name,
            area: drilldown[0].area,
            shift_code: drilldown[0].shift_code,
          }
        : null,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/drilldown] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load drilldown" },
      { status: 500 }
    );
  }
}
