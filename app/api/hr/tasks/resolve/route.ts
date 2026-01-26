import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Authenticate and get org session
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Verify user has access to HR tasks (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json({ error: "Forbidden: HR admin access required" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    const userId = session.userId;

    // Parse request body
    const body = await request.json();
    const { taskSource, taskId, status, note } = body;

    // Validate inputs
    if (!taskSource || !taskId || !status) {
      const res = NextResponse.json(
        { error: "taskSource, taskId, and status are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (taskSource !== "medical_check" && taskSource !== "certificate") {
      const res = NextResponse.json(
        { error: "taskSource must be 'medical_check' or 'certificate'" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (status !== "resolved" && status !== "snoozed") {
      const res = NextResponse.json(
        { error: "status must be 'resolved' or 'snoozed'" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Upsert resolution (idempotent)
    const upsertQuery = `
      INSERT INTO hr_task_resolutions (org_id, task_source, task_id, status, note, resolved_by, resolved_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (org_id, task_source, task_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        note = EXCLUDED.note,
        resolved_by = EXCLUDED.resolved_by,
        resolved_at = NOW()
      RETURNING id, org_id, task_source, task_id, status, note, resolved_by, resolved_at
    `;

    const result = await pool.query(upsertQuery, [
      orgId,
      taskSource,
      taskId,
      status,
      note || null,
      userId,
    ]);

    const res = NextResponse.json({
      success: true,
      resolution: result.rows[0],
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/hr/tasks/resolve failed:", err);
    const res = NextResponse.json({ error: "Internal error" }, { status: 500 });
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      // Ignore cookie errors on error path
    }
    return res;
  }
}
