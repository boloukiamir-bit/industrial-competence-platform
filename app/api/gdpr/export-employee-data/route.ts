import { NextRequest, NextResponse } from "next/server";
import { exportEmployeeData } from "@/services/gdpr";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employee_id");

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id is required" }, { status: 400 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const data = await exportEmployeeData(employeeId, session.orgId);
    const res = NextResponse.json(data);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Error exporting employee data:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
