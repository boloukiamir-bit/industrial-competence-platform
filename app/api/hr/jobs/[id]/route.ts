/**
 * GET /api/hr/jobs/[id] — single HR job with template and employee details. Admin/HR only.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id?.trim()) {
    const res = NextResponse.json({ error: "Job id required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const result = await pool.query(
      `SELECT j.id, j.org_id, j.template_id, j.employee_id, j.title, j.rendered_body, j.status, j.created_at,
              t.name AS template_name,
              e.name AS employee_name, e.first_name, e.last_name, e.employee_number
       FROM hr_jobs j
       JOIN hr_templates t ON t.id = j.template_id
       JOIN employees e ON e.id = j.employee_id
       WHERE j.id = $1 AND j.org_id = $2`,
      [id.trim(), auth.activeOrgId]
    );

    const row = result.rows[0];
    if (!row) {
      const res = NextResponse.json({ error: "Job not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const job = {
      id: row.id,
      templateId: row.template_id,
      employeeId: row.employee_id,
      title: row.title,
      renderedBody: row.rendered_body,
      status: row.status,
      createdAt: row.created_at,
      templateName: row.template_name,
      employeeName: row.employee_name ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || "—"),
      employeeNumber: row.employee_number ?? "",
    };

    const eventsResult = await pool.query(
      `SELECT id, event_type, from_status, to_status, actor_email, note, created_at
       FROM hr_job_events
       WHERE job_id = $1 AND org_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [id.trim(), auth.activeOrgId]
    );
    const events = eventsResult.rows.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      actorEmail: e.actor_email ?? null,
      note: e.note ?? null,
      createdAt: e.created_at,
    }));

    const res = NextResponse.json({ ...job, events });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/hr/jobs/[id] failed:", msg);
    const res = NextResponse.json({ error: msg }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
