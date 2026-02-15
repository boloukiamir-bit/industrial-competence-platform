import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PREFERRED_ORDER = ["S1", "S2", "Day", "Evening", "Night"];

function sortShiftCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const i = PREFERRED_ORDER.indexOf(a);
    const j = PREFERRED_ORDER.indexOf(b);
    if (i !== -1 && j !== -1) return i - j;
    if (i !== -1) return -1;
    if (j !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** Distinct shift_code from v_cockpit_station_summary for date; same org/site scope as summary. */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const date = request.nextUrl.searchParams.get("date")?.trim();
    if (!date) {
      const res = NextResponse.json({ ok: true, shift_codes: [] });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = supabaseAdmin
      .from("v_cockpit_station_summary")
      .select("shift_code")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date);

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/shift-codes] v_cockpit_station_summary error:", error);
      const res = NextResponse.json({ ok: true, shift_codes: [] });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const raw = [...new Set((rows ?? []).map((r: { shift_code?: string | null }) => r.shift_code).filter((v): v is string => Boolean(v)))];
    const shift_codes = sortShiftCodes(raw);
    const res = NextResponse.json({ ok: true, shift_codes });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/shift-codes] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to get shift codes" }, { status: 500 });
  }
}
