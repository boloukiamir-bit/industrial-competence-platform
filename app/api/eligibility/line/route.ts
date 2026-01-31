import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getEligibilityByLine } from "@/services/eligibilityService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const line = searchParams.get("line")?.trim();
  const _shiftDate = searchParams.get("shift_date")?.trim();
  const _shiftType = searchParams.get("shift_type")?.trim();

  if (!line) {
    return NextResponse.json({ error: "line is required" }, { status: 400 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();
    if (profileError) {
      throw profileError;
    }
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;

    const result = await getEligibilityByLine(supabase, activeOrgId, line);

    const res = NextResponse.json({
      line: result.line,
      stations_required: result.stations_required,
      required_skills_count: result.required_skills_count,
      required_skill_codes: result.required_skill_codes,
      employees: result.employees.slice(0, 50),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("GET /api/eligibility/line failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
