/**
 * POST /api/hr/workflows/provision — provision pending step rows for active employees (admin/HR only).
 * Body: { workflow_code?: "ONBOARDING" | "OFFBOARDING" } default "ONBOARDING"
 * Idempotent: ON CONFLICT (org_id, employee_id, step_id) DO NOTHING.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_WORKFLOW_CODES = ["ONBOARDING", "OFFBOARDING"] as const;
const SITE_FILTER = "($2::uuid IS NULL OR e.site_id IS NULL OR e.site_id = $2)";

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, activeSiteId, userId } = org;

  const roleResult = await pool.query(
    `SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
    [userId, activeOrgId]
  );
  const role = roleResult.rows[0]?.role as string | undefined;
  if (!role || (role !== "admin" && role !== "hr")) {
    return NextResponse.json({ error: "Only admins and HR can provision workflows" }, { status: 403 });
  }

  let body: { workflow_code?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const workflowCode = (body.workflow_code ?? "ONBOARDING").trim().toUpperCase();
  if (!VALID_WORKFLOW_CODES.includes(workflowCode as (typeof VALID_WORKFLOW_CODES)[number])) {
    return NextResponse.json(
      { error: `workflow_code must be one of: ${VALID_WORKFLOW_CODES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const workflowResult = await pool.query(
      `SELECT id FROM hr_workflows WHERE org_id = $1 AND code = $2 AND is_active = true LIMIT 1`,
      [activeOrgId, workflowCode]
    );
    if (workflowResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Workflow not found: ${workflowCode}` },
        { status: 404 }
      );
    }
    const workflowId = (workflowResult.rows[0] as { id: string }).id;

    const stepsCountResult = await pool.query(
      `SELECT COUNT(*)::int AS c FROM hr_workflow_steps WHERE workflow_id = $1`,
      [workflowId]
    );
    const stepsCount = Number(stepsCountResult.rows[0]?.c ?? 0);

    const empCountResult = await pool.query(
      `SELECT COUNT(*)::int AS c FROM employees e
       WHERE e.org_id = $1 AND e.is_active = true AND ${SITE_FILTER}`,
      [activeOrgId, activeSiteId]
    );
    const employeesProcessed = Number(empCountResult.rows[0]?.c ?? 0);
    const expectedRows = employeesProcessed * stepsCount;

    await pool.query(
      `INSERT INTO employee_hr_step_status (org_id, site_id, employee_id, workflow_id, step_id, status, due_date)
       SELECT $1, $2, e.id, $3, s.id, 'pending',
         CASE WHEN s.default_due_days IS NOT NULL
           THEN (CURRENT_DATE + (s.default_due_days)::int * INTERVAL '1 day')::date
           ELSE NULL END
       FROM employees e
       CROSS JOIN hr_workflow_steps s
       WHERE s.workflow_id = $3 AND e.org_id = $1 AND e.is_active = true AND ${SITE_FILTER}
       ON CONFLICT (org_id, employee_id, step_id) DO NOTHING`,
      [activeOrgId, activeSiteId, workflowId]
    );

    return NextResponse.json({
      ok: true,
      employeesProcessed,
      stepsExpected: expectedRows,
      stepsCount,
      workflowCode,
    });
  } catch (err) {
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to provision workflow steps" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
