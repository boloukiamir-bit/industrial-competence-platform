/**
 * GET /api/hr/overview — HR Overview KPIs for pilot.
 * Tenant-safe: active org from session; activeSiteId filter same as other HR routes.
 * Open step = status 'pending'. onboardingOpen/offboardingOpen = distinct employees with any open step in that workflow.
 * After provisioning (POST /api/hr/workflows/provision), pending rows exist so KPIs become non-zero. Dates: UTC date-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** UTC date string YYYY-MM-DD for today and today+7. */
function getUtcDateParams(): { today: string; todayPlus7: string } {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayStr = todayUtc.toISOString().slice(0, 10);
  const plus7 = new Date(todayUtc);
  plus7.setUTCDate(plus7.getUTCDate() + 7);
  const todayPlus7Str = plus7.toISOString().slice(0, 10);
  return { today: todayStr, todayPlus7: todayPlus7Str };
}

function isMissingTableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist|42P01|undefined_table/i.test(message);
}

function getPgCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: string }).code === "string") {
    return (err as { code: string }).code;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, activeSiteId } = org;
  const { today, todayPlus7 } = getUtcDateParams();
  const siteFilter = "($2::uuid IS NULL OR e.site_id IS NULL OR e.site_id = $2)";
  const params = [activeOrgId, activeSiteId, today, todayPlus7];

  try {
    const employeesTotalResult = await pool.query(
      `SELECT COUNT(*)::int AS c FROM employees e
       WHERE e.org_id = $1 AND e.is_active = true AND ${siteFilter}`,
      [params[0], params[1]]
    );
    const employeesTotal = Number(employeesTotalResult.rows[0]?.c ?? 0);

    const onboardingResult = await pool.query(
      `SELECT COUNT(DISTINCT ehs.employee_id)::int AS c
       FROM employee_hr_step_status ehs
       JOIN hr_workflows w ON w.id = ehs.workflow_id AND w.org_id = $1
       JOIN employees e ON e.id = ehs.employee_id AND e.org_id = $1 AND e.is_active = true AND ${siteFilter}
       WHERE ehs.status = 'pending' AND w.code = 'ONBOARDING'`,
      [params[0], params[1]]
    );
    const onboardingOpen = Number(onboardingResult.rows[0]?.c ?? 0);

    const offboardingResult = await pool.query(
      `SELECT COUNT(DISTINCT ehs.employee_id)::int AS c
       FROM employee_hr_step_status ehs
       JOIN hr_workflows w ON w.id = ehs.workflow_id AND w.org_id = $1
       JOIN employees e ON e.id = ehs.employee_id AND e.org_id = $1 AND e.is_active = true AND ${siteFilter}
       WHERE ehs.status = 'pending' AND w.code = 'OFFBOARDING'`,
      [params[0], params[1]]
    );
    const offboardingOpen = Number(offboardingResult.rows[0]?.c ?? 0);

    const overdueResult = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM employee_hr_step_status ehs
       JOIN employees e ON e.id = ehs.employee_id AND e.org_id = $1 AND e.is_active = true AND ${siteFilter}
       WHERE ehs.org_id = $1 AND ehs.status = 'pending' AND ehs.due_date IS NOT NULL AND ehs.due_date < $3::date`,
      [params[0], params[1], params[2]]
    );
    const overdueSteps = Number(overdueResult.rows[0]?.c ?? 0);

    const dueNext7Result = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM employee_hr_step_status ehs
       JOIN employees e ON e.id = ehs.employee_id AND e.org_id = $1 AND e.is_active = true AND ${siteFilter}
       WHERE ehs.org_id = $1 AND ehs.status = 'pending' AND ehs.due_date IS NOT NULL AND ehs.due_date >= $3::date AND ehs.due_date <= $4::date`,
      [params[0], params[1], params[2], params[3]]
    );
    const dueNext7Days = Number(dueNext7Result.rows[0]?.c ?? 0);

    const topIssuesResult = await pool.query(
      `SELECT w.code AS workflow_code, st.code AS step_code, COUNT(*)::int AS cnt
       FROM employee_hr_step_status ehs
       JOIN hr_workflows w ON w.id = ehs.workflow_id AND w.org_id = $1
       JOIN hr_workflow_steps st ON st.id = ehs.step_id
       JOIN employees e ON e.id = ehs.employee_id AND e.org_id = $1 AND e.is_active = true AND ${siteFilter}
       WHERE ehs.status = 'pending'
       GROUP BY w.code, st.code
       ORDER BY cnt DESC
       LIMIT 10`,
      [params[0], params[1]]
    );
    const topIssues = topIssuesResult.rows.map((r: { workflow_code: string; step_code: string; cnt: number }) => ({
      workflowCode: r.workflow_code,
      stepCode: r.step_code,
      openCount: r.cnt,
    }));

    const dueSoonResult = await pool.query(
      `SELECT e.id AS employee_id, e.employee_number, COALESCE(e.name, TRIM(e.first_name || ' ' || COALESCE(e.last_name, ''))) AS name,
              w.code AS workflow_code, st.code AS step_code, ehs.due_date
       FROM employee_hr_step_status ehs
       JOIN hr_workflows w ON w.id = ehs.workflow_id AND w.org_id = $1
       JOIN hr_workflow_steps st ON st.id = ehs.step_id
       JOIN employees e ON e.id = ehs.employee_id AND e.org_id = $1 AND e.is_active = true AND ${siteFilter}
       WHERE ehs.status = 'pending' AND ehs.due_date IS NOT NULL AND ehs.due_date >= $3::date AND ehs.due_date <= $4::date
       ORDER BY ehs.due_date ASC
       LIMIT 20`,
      [params[0], params[1], params[2], params[3]]
    );
    const dueSoon = dueSoonResult.rows.map((r: { employee_id: string; employee_number: string | null; name: string | null; workflow_code: string; step_code: string; due_date: string | null }) => ({
      employeeId: r.employee_id,
      employeeNumber: r.employee_number ?? "",
      name: (r.name ?? "").trim() || "",
      workflowCode: r.workflow_code,
      stepCode: r.step_code,
      dueDate: r.due_date ?? null,
    }));

    return NextResponse.json({
      employeesTotal,
      onboardingOpen,
      offboardingOpen,
      overdueSteps,
      dueNext7Days,
      topIssues,
      dueSoon,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      const code = getPgCode(err) ?? "MISSING_TABLE";
      const res = NextResponse.json({ step: "backend", code }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch HR overview" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
