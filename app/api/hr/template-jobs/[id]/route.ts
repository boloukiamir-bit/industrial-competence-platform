/**
 * GET /api/hr/template-jobs/[id] — fetch single job with template + employee.
 * PATCH /api/hr/template-jobs/[id] — update job. Body: status?, owner_user_id?, due_date?, notes?, filled_values?
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_STATUS = ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

function logDecision(
  admin: ReturnType<typeof getSupabaseAdmin>,
  org: { activeOrgId: string; activeSiteId: string | null; userId: string },
  jobId: string,
  decisionType: string,
  reason: string,
  actions: Record<string, unknown>
) {
  const root_cause = { type: "hr_template_job", job_id: jobId, ...actions };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).from("execution_decisions")
    .insert({
    org_id: org.activeOrgId,
    site_id: org.activeSiteId ?? null,
    decision_type: decisionType,
    target_type: "hr_template_job",
    target_id: jobId,
    reason,
    root_cause,
    actions,
    status: "active",
    created_by: org.userId,
  } as Record<string, unknown>);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const { id } = await params;
  try {
    const result = await pool.query(
      `SELECT j.id, j.template_code, j.employee_id, j.owner_user_id, j.status, j.due_date, j.notes,
              j.filled_values, j.created_at, j.updated_at, j.created_by,
              e.name as employee_name, e.employee_number, e.line_code, e.line,
              t.name as template_name, t.category, t.content as template_content
       FROM hr_template_jobs j
       JOIN employees e ON e.id = j.employee_id AND e.org_id = j.org_id
       LEFT JOIN hr_templates t ON t.org_id = j.org_id AND t.code = j.template_code
       WHERE j.id = $1 AND j.org_id = $2`,
      [id, org.activeOrgId]
    );
    const row = result.rows[0];
    if (!row) {
      const res = NextResponse.json({ error: "Job not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const res = NextResponse.json({
      id: row.id,
      templateCode: row.template_code,
      templateName: row.template_name ?? row.template_code,
      templateCategory: row.category ?? "",
      templateContent: row.template_content ?? {},
      employeeId: row.employee_id,
      employeeName: row.employee_name ?? "",
      employeeNumber: row.employee_number ?? "",
      employeeLine: row.line ?? row.line_code ?? "",
      ownerUserId: row.owner_user_id ?? null,
      status: row.status,
      dueDate: row.due_date ?? null,
      notes: row.notes ?? null,
      filledValues: row.filled_values ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (e) {
    console.error("[template-jobs] GET [id] error", e);
    const res = NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch job" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const { id } = await params;
  let body: {
    status?: string;
    owner_user_id?: string | null;
    due_date?: string | null;
    notes?: string | null;
    filled_values?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON", step: "body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const updates: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (body.status !== undefined) {
    const s = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (VALID_STATUS.includes(s as (typeof VALID_STATUS)[number])) {
      updates.push(`status = $${i++}`);
      vals.push(s);
    }
  }
  if (body.owner_user_id !== undefined) {
    const o =
      body.owner_user_id === null
        ? null
        : typeof body.owner_user_id === "string"
          ? body.owner_user_id.trim() || null
          : null;
    updates.push(`owner_user_id = $${i++}`);
    vals.push(o);
  }
  if (body.due_date !== undefined) {
    const d = body.due_date == null ? null : typeof body.due_date === "string" ? body.due_date.trim() || null : null;
    updates.push(`due_date = $${i++}`);
    vals.push(d);
  }
  if (body.notes !== undefined) {
    const n = body.notes == null ? null : typeof body.notes === "string" ? body.notes.trim() || null : null;
    updates.push(`notes = $${i++}`);
    vals.push(n);
  }
  if (body.filled_values !== undefined && typeof body.filled_values === "object") {
    updates.push(`filled_values = $${i++}::jsonb`);
    vals.push(JSON.stringify(body.filled_values));
  }
  if (updates.length === 0) {
    const res = NextResponse.json(
      { error: "No valid fields to update", step: "validation" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  updates.push(`updated_at = now()`);
  vals.push(id, org.activeOrgId);
  const whereClause = `id = $${i++} AND org_id = $${i}`;

  try {
    const result = await pool.query(
      `UPDATE hr_template_jobs SET ${updates.join(", ")} WHERE ${whereClause} RETURNING id, status, owner_user_id, due_date, notes, filled_values, updated_at`,
      vals
    );
    const row = result.rows[0];
    if (!row) {
      const res = NextResponse.json({ error: "Job not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const supabaseAdmin = getSupabaseAdmin();
    const decisionType = body.status !== undefined ? "hr_template_job_status" : "hr_template_job_updated";
    const reason =
      body.status !== undefined
        ? `Status updated to ${body.status}`
        : body.owner_user_id !== undefined
          ? "Owner reassigned"
          : "Job updated";
    await logDecision(supabaseAdmin, org, id, decisionType, reason, {
      status: row.status,
      owner_user_id: row.owner_user_id,
    });
    const res = NextResponse.json({
      id: row.id,
      status: row.status,
      ownerUserId: row.owner_user_id ?? null,
      dueDate: row.due_date ?? null,
      notes: row.notes ?? null,
      filledValues: row.filled_values ?? {},
      updatedAt: row.updated_at,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (e) {
    console.error("[template-jobs] PATCH [id] error", e);
    const res = NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update job" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
