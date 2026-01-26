import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cockpit/shift-ids?date=YYYY-MM-DD&shift=Day
 * Returns shift IDs for (org, date, shift_type) with no line filter.
 * Used when line === "all" to fetch assignments across all lines.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const shift = searchParams.get("shift");

    if (!date || !shift) {
      const res = NextResponse.json(
        { error: "date and shift are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();

    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;

    const { data: rows, error } = await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("shift_date", date)
      .eq("shift_type", shift);

    if (error) {
      console.error("cockpit/shift-ids: shifts query error", error);
      const res = NextResponse.json({ error: "Failed to fetch shift IDs" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shift_ids = (rows || []).map((r: { id: string }) => r.id).filter(Boolean);
    const res = NextResponse.json({ shift_ids });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("cockpit/shift-ids error:", err);
    return NextResponse.json(
      { error: "Failed to load shift IDs" },
      { status: 500 }
    );
  }
}
