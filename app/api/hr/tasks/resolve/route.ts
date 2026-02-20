import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

export const POST = withMutationGovernance(
  async (ctx) => {
    const roleResult = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [ctx.userId, ctx.orgId]
    );
    const role = roleResult.rows[0]?.role as string | undefined;
    if (!role || (role !== "admin" && role !== "hr")) {
      return NextResponse.json(
        { error: "Forbidden: HR admin access required" },
        { status: 403 }
      );
    }

    const taskSource = typeof ctx.body.taskSource === "string" ? ctx.body.taskSource.trim() : "";
    const taskId = typeof ctx.body.taskId === "string" ? ctx.body.taskId.trim() : "";
    const status = typeof ctx.body.status === "string" ? ctx.body.status.trim() : "";
    const note = typeof ctx.body.note === "string" ? ctx.body.note.trim() : null;

    if (!taskSource || !taskId || !status) {
      return NextResponse.json(
        { error: "taskSource, taskId, and status are required" },
        { status: 400 }
      );
    }

    if (taskSource !== "medical_check" && taskSource !== "certificate") {
      return NextResponse.json(
        { error: "taskSource must be 'medical_check' or 'certificate'" },
        { status: 400 }
      );
    }

    if (status !== "resolved" && status !== "snoozed") {
      return NextResponse.json(
        { error: "status must be 'resolved' or 'snoozed'" },
        { status: 400 }
      );
    }

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
      ctx.orgId,
      taskSource,
      taskId,
      status,
      note ?? null,
      ctx.userId,
    ]);

    return NextResponse.json({
      ok: true,
      success: true,
      resolution: queryResult.rows[0],
    });
  },
  {
    route: "/api/hr/tasks/resolve",
    action: "HR_TASK_RESOLVE",
    target_type: "hr_task",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => {
      const taskSource = typeof body.taskSource === "string" ? body.taskSource.trim() : "";
      const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
      return {
        target_id: taskSource && taskId ? `${taskSource}:${taskId}` : "unknown",
        meta: {
          task_id: taskId,
          task_source: taskSource,
          status: typeof body.status === "string" ? body.status.trim() : "",
        },
      };
    },
  }
);
