/**
 * GET /api/attendance?date=&shift=
 * Returns list { employee_number, name, status } for org/date/shift.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShift } from "@/lib/shift";

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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const shiftRaw = searchParams.get("shift") ?? "Day";
    const shift = normalizeShift(shiftRaw);
    if (!shift) {
      const res = NextResponse.json({ error: "Invalid shift parameter" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: rows, error } = await supabaseAdmin
      .from("attendance_records")
      .select(`
        status,
        employee:employees!inner(employee_number, name)
      `)
      .eq("org_id", org.activeOrgId)
      .eq("work_date", date)
      .eq("shift_type", shift);

    if (error) {
      console.error("[attendance] GET error:", error);
      const res = NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const attendance = (rows || []).map((r: { status: string; employee?: { employee_number?: string; name?: string } | { employee_number?: string; name?: string }[] }) => {
      const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee;
      return {
        employee_number: emp?.employee_number ?? "",
        name: emp?.name ?? "",
        status: r.status,
      };
    });

    const res = NextResponse.json({ attendance });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[attendance] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
