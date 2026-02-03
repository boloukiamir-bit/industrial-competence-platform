/**
 * POST /api/hr/workflows/employee/upsert — upsert step status (admin/HR only).
 * Body: employee_id, workflow_code, step_code, status, due_date?, notes?, evidence_url?
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getOrgIdFromSession, isAdminOrHr } from "@/lib/orgSession";

export const runtime = "nodejs";

const VALID_STATUSES = ["pending", "done", "waived"] as const;

export async function POST(request: NextRequest) {
  const session = await getOrgIdFromSession(request);
  if (!session.success) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  if (!isAdminOrHr(session.role)) {
    return NextResponse.json({ error: "Only admins and HR can update step status" }, { status: 403 });
  }

  let body: { employee_id?: string; workflow_code?: string; step_code?: string; status?: string; due_date?: string | null; notes?: string | null; evidence_url?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { employee_id, workflow_code, step_code, status } = body;
  if (!employee_id || !workflow_code || !step_code || !status) {
    return NextResponse.json(
      { error: "employee_id, workflow_code, step_code, and status are required" },
      { status: 400 }
    );
  }
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const orgId = session.orgId;
  const due_date = body.due_date ?? null;
  const notes = body.notes ?? null;
  const evidence_url = body.evidence_url ?? null;

  try {
    const stepRow = await pool.query(
      `SELECT s.id AS step_id, s.workflow_id FROM hr_workflow_steps s
       JOIN hr_workflows w ON w.id = s.workflow_id
       WHERE w.org_id = $1 AND w.code = $2 AND s.code = $3 LIMIT 1`,
      [orgId, workflow_code, step_code]
    );
    if (stepRow.rows.length === 0) {
      return NextResponse.json(
        { error: `Workflow step not found: ${workflow_code}/${step_code}` },
        { status: 404 }
      );
    }
    const { step_id, workflow_id } = stepRow.rows[0] as { step_id: string; workflow_id: string };

    await pool.query(
      `INSERT INTO employee_hr_step_status (org_id, employee_id, workflow_id, step_id, status, due_date, notes, evidence_url, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, now())
       ON CONFLICT (org_id, employee_id, step_id) DO UPDATE SET
         status = EXCLUDED.status,
         due_date = EXCLUDED.due_date,
         notes = EXCLUDED.notes,
         evidence_url = EXCLUDED.evidence_url,
         completed_at = CASE WHEN EXCLUDED.status = 'done' AND employee_hr_step_status.completed_at IS NULL THEN now() ELSE employee_hr_step_status.completed_at END,
         updated_at = now()`,
      [orgId, employee_id, workflow_id, step_id, status, due_date, notes, evidence_url]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upsert step status" },
      { status: 500 }
    );
  }
}
