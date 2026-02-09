import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** GET /api/cockpit/issues/areas?shift_code=X — distinct area from v_cockpit_station_summary for org/site/shift */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { activeOrgId, activeSiteId } = org;
    const shiftCode = request.nextUrl.searchParams.get("shift_code")?.trim();

    if (!shiftCode) {
      const res = NextResponse.json(
        { ok: false, error: "shift_code is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = supabaseAdmin
      .from("v_cockpit_station_summary")
      .select("area")
      .eq("org_id", activeOrgId)
      .eq("shift_code", shiftCode);

    if (activeSiteId) {
      query = query.eq("site_id", activeSiteId);
    } else {
      query = query.is("site_id", null);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/issues/areas] query error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch areas" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const areas = [...new Set((rows || []).map((r) => r.area as string | null).filter((a): a is string => Boolean(a)))].sort();
    const res = NextResponse.json({ ok: true, areas });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/areas] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load areas" },
      { status: 500 }
    );
  }
}
