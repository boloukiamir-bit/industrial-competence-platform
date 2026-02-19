import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireGovernedMutation } from "@/lib/server/governance/firewall";
import { withGovernanceGate } from "@/lib/server/governance/withGovernanceGate";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

function getAdmin(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const admin = getAdmin();
    const fw = requireGovernedMutation({
      admin,
      governed: true,
      context: { route: "/api/hr/tasks/resolve", action: "HR_TASK_RESOLVE" },
    });
    if (!fw.ok) {
      const res = NextResponse.json(fw.body, { status: fw.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const roleResult = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [org.userId, org.activeOrgId]
    );
    const role = roleResult.rows[0]?.role as string | undefined;
    if (!role || (role !== "admin" && role !== "hr")) {
      const res = NextResponse.json(
        { error: "Forbidden: HR admin access required" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const taskSource = typeof body.taskSource === "string" ? body.taskSource.trim() : "";
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : null;

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

    const target_id = `${taskSource}:${taskId}`;

    const result = await withGovernanceGate({
      supabase,
      admin: admin!,
      orgId: org.activeOrgId,
      siteId: org.activeSiteId,
      context: {
        action: "HR_TASK_RESOLVE",
        target_type: "hr_task",
        target_id,
        meta: {
          route: "/api/hr/tasks/resolve",
          task_id: taskId,
          task_source: taskSource,
          status,
        },
      },
      handler: async () => {
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
        const queryResult = await pool.query(upsertQuery, [
          org.activeOrgId,
          taskSource,
          taskId,
          status,
          note ?? null,
          org.userId,
        ]);
        return {
          success: true,
          resolution: queryResult.rows[0],
        };
      },
    });

    if (!result.ok) {
      const res = NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, ...result.data });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/hr/tasks/resolve failed:", err);
    const res = NextResponse.json({ error: "Internal error" }, { status: 500 });
    try {
      const { pendingCookies } = await createSupabaseServerClient(request);
      applySupabaseCookies(res, pendingCookies);
    } catch {
      // Ignore cookie errors on error path
    }
    return res;
  }
}
