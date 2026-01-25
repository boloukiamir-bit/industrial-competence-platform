import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";

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
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const shift = searchParams.get("shift");

    if (!date || !shift) {
      return NextResponse.json(
        { error: "date and shift are required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();

    const activeOrgId = (profile?.active_org_id as string) || session.orgId;

    const { data: rows, error } = await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("shift_date", date)
      .eq("shift_type", shift);

    if (error) {
      console.error("cockpit/shift-ids: shifts query error", error);
      return NextResponse.json({ error: "Failed to fetch shift IDs" }, { status: 500 });
    }

    const shift_ids = (rows || []).map((r: { id: string }) => r.id).filter(Boolean);
    return NextResponse.json({ shift_ids });
  } catch (err) {
    console.error("cockpit/shift-ids error:", err);
    return NextResponse.json(
      { error: "Failed to load shift IDs" },
      { status: 500 }
    );
  }
}
