import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type CockpitComplianceSummaryResponse = {
  ok: true;
  legal_blockers_count: number;
  expiring_30d_count: number;
  missing_count: number;
  valid_count: number;
  valid_pct: number;
  total_employees: number;
  warnings_count: number;
};

const CHUNK_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim() || undefined;
    const rawShift = searchParams.get("shift_code") ?? searchParams.get("shift");
    const lineParam = (searchParams.get("line") ?? searchParams.get("area"))?.trim();
    const lineFilter = lineParam && lineParam !== "all" ? lineParam : undefined;

    if (!date || !rawShift) {
      const res = NextResponse.json(
        { ok: false, error: "date and shift are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shift = normalizeShiftParam(rawShift);
    if (!shift) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter", details: { shift: rawShift } },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let employeesQuery = supabaseAdmin
      .from("employees")
      .select("id")
      .eq("org_id", org.activeOrgId)
      .eq("is_active", true);
    if (org.activeSiteId) {
      employeesQuery = employeesQuery.or(
        `site_id.is.null,site_id.eq.${org.activeSiteId}`
      );
    }
    if (lineFilter) {
      employeesQuery = employeesQuery.eq("line_code", lineFilter);
    }
    const { data: employees, error: employeesError } = await employeesQuery;
    if (employeesError) {
      console.error("[cockpit/compliance-summary] employees error:", employeesError);
      const res = NextResponse.json({ ok: false, error: "Failed to load employees" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeIds = (employees ?? [])
      .map((row: { id?: string | null }) => row.id)
      .filter((id): id is string => Boolean(id));
    const totalEmployees = employeeIds.length;

    if (totalEmployees === 0) {
      const res = NextResponse.json({
        ok: true,
        legal_blockers_count: 0,
        expiring_30d_count: 0,
        missing_count: 0,
        valid_count: 0,
        valid_pct: 0,
        total_employees: 0,
        warnings_count: 0,
      } satisfies CockpitComplianceSummaryResponse);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const expiredEmployees = new Set<string>();
    const missingEmployees = new Set<string>();
    const expiringEmployees = new Set<string>();

    for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
      const chunk = employeeIds.slice(i, i + CHUNK_SIZE);
      const { data: statusRows, error: statusError } = await supabaseAdmin
        .from("v_employee_compliance_status")
        .select("employee_id, status")
        .eq("org_id", org.activeOrgId)
        .in("employee_id", chunk);

      if (statusError) {
        console.error("[cockpit/compliance-summary] status error:", statusError);
        const res = NextResponse.json({ ok: false, error: "Failed to load compliance status" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      for (const row of statusRows ?? []) {
        const employeeId = (row as { employee_id?: string | null }).employee_id;
        if (!employeeId) continue;
        const status = String((row as { status?: string | null }).status ?? "").toUpperCase();
        if (status === "EXPIRED") expiredEmployees.add(employeeId);
        else if (status === "MISSING") missingEmployees.add(employeeId);
        else if (status === "EXPIRING_30" || status === "EXPIRING_7") expiringEmployees.add(employeeId);
      }
    }

    const warningsEmployees = new Set<string>([...missingEmployees, ...expiringEmployees]);
    const employeesWithAnyIssue = new Set<string>([
      ...expiredEmployees,
      ...missingEmployees,
      ...expiringEmployees,
    ]);
    const validCount = Math.max(0, totalEmployees - employeesWithAnyIssue.size);
    const validPct = totalEmployees > 0 ? Math.round((validCount / totalEmployees) * 100) : 0;

    const res = NextResponse.json({
      ok: true,
      legal_blockers_count: expiredEmployees.size,
      expiring_30d_count: expiringEmployees.size,
      missing_count: missingEmployees.size,
      valid_count: validCount,
      valid_pct: validPct,
      total_employees: totalEmployees,
      warnings_count: warningsEmployees.size,
    } satisfies CockpitComplianceSummaryResponse);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/compliance-summary] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load compliance summary" },
      { status: 500 }
    );
  }
}
