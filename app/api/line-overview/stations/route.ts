/**
 * GET /api/line-overview/stations — stations for the active tenant (session-scoped).
 * Use getActiveOrgFromSession. Returns station_name + station_code (name + code) per station, grouped by line.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const { data: rows, error } = await supabaseAdmin
      .from("stations")
      .select("id, name, code, line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null)
      .order("line")
      .order("name");

    if (error) {
      const res = NextResponse.json({ error: "Failed to fetch stations" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stations = (rows || []).map((s: { id: string; name: string | null; code: string | null; line: string | null }) => ({
      id: s.id,
      station_name: s.name ?? "",
      station_code: s.code ?? s.id,
      line: s.line ?? "",
    }));

    const res = NextResponse.json({ stations });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("Line overview stations error:", err);
    return NextResponse.json({ error: "Failed to fetch stations" }, { status: 500 });
  }
}
