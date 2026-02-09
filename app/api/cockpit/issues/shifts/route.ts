import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** GET /api/cockpit/issues/shifts — distinct shift_code from v_cockpit_station_summary for active org/site */
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

    let query = supabaseAdmin
      .from("v_cockpit_station_summary")
      .select("shift_code")
      .eq("org_id", activeOrgId);

    if (activeSiteId) {
      query = query.eq("site_id", activeSiteId);
    } else {
      query = query.is("site_id", null);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/issues/shifts] query error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch shifts" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftCodes = [...new Set((rows || []).map((r) => r.shift_code as string).filter(Boolean))].sort();
    const res = NextResponse.json({ ok: true, shift_codes: shiftCodes });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/shifts] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load shifts" },
      { status: 500 }
    );
  }
}
