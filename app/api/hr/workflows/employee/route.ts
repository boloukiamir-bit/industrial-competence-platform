/**
 * GET /api/hr/workflows/employee?employeeId= — workflows with step statuses for one employee.
 * Default status 'pending' when no row in employee_hr_step_status.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employeeId = new URL(request.url).searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const { activeOrgId, activeSiteId } = org;
  try {
    const workflowsResult = await pool.query(
      `SELECT w.id, w.code FROM hr_workflows w
       WHERE w.org_id = $1 AND w.is_active = true
         AND ($2::uuid IS NULL OR w.site_id IS NULL OR w.site_id = $2)
       ORDER BY w.code`,
      [activeOrgId, activeSiteId]
    );

    const statusRows = await pool.query(
      `SELECT ehs.step_id, st.code AS step_code, ehs.status, ehs.due_date, ehs.completed_at, ehs.notes
       FROM employee_hr_step_status ehs
       JOIN hr_workflow_steps st ON st.id = ehs.step_id
       WHERE ehs.org_id = $1 AND ehs.employee_id = $2`,
      [activeOrgId, employeeId]
    );
    const statusByStepId = new Map(
      statusRows.rows.map((r: { step_id: string; step_code: string; status: string; due_date: string | null; completed_at: string | null; notes: string | null }) => [
        r.step_id,
        { stepCode: r.step_code, status: r.status, dueDate: r.due_date, completedAt: r.completed_at, notes: r.notes },
      ])
    );

    const data: Array<{ workflowCode: string; steps: Array<{ stepCode: string; status: string; dueDate: string | null; completedAt: string | null; notes: string | null }> }> = [];
    for (const w of workflowsResult.rows) {
      const stepsResult = await pool.query(
        `SELECT id, code FROM hr_workflow_steps WHERE workflow_id = $1 ORDER BY step_order`,
        [w.id]
      );
      data.push({
        workflowCode: w.code,
        steps: stepsResult.rows.map((s: { id: string; code: string }) => {
          const st = statusByStepId.get(s.id);
          return {
            stepCode: s.code,
            status: st?.status ?? "pending",
            dueDate: st?.dueDate ?? null,
            completedAt: st?.completedAt ?? null,
            notes: st?.notes ?? null,
          };
        }),
      });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|connect ECONNREFUSED|Missing DATABASE_URL/i.test(message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch employee workflow status" },
      { status: 500 }
    );
  }
}
