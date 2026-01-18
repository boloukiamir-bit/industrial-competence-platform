import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";
import { cookies } from "next/headers";

async function getOrgId(request: NextRequest): Promise<string | null> {
  const orgId = request.headers.get("x-org-id");
  if (orgId) return orgId;
  
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get("current_org_id");
  return orgCookie?.value || null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params;
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { taskId, status, ownerUserId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const instanceResult = await pool.query(
      `SELECT id, org_id FROM wf_instances WHERE id = $1 AND org_id = $2`,
      [instanceId, orgId]
    );

    if (instanceResult.rows.length === 0) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    if (status && !["todo", "in_progress", "done", "blocked"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const completedAt = status === "done" ? new Date().toISOString() : null;

    let updateQuery = `UPDATE wf_instance_tasks SET updated_at = NOW()`;
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      updateQuery += `, status = $${paramIndex}`;
      updateParams.push(status);
      paramIndex++;
      updateQuery += `, completed_at = $${paramIndex}`;
      updateParams.push(completedAt);
      paramIndex++;
    }

    if (ownerUserId !== undefined) {
      updateQuery += `, owner_user_id = $${paramIndex}`;
      updateParams.push(ownerUserId);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} AND instance_id = $${paramIndex + 1} RETURNING id, title, status`;
    updateParams.push(taskId, instanceId);

    const taskResult = await pool.query(updateQuery, updateParams);

    if (taskResult.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskResult.rows[0];

    await pool.query(
      `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
       VALUES ($1, 'task', $2, $3, $4)`,
      [
        orgId,
        taskId,
        status ? `status_changed_to_${status}` : "updated",
        JSON.stringify({ instanceId, taskTitle: task.title, newStatus: status, ownerUserId }),
      ]
    );

    const allTasksResult = await pool.query(
      `SELECT status FROM wf_instance_tasks WHERE instance_id = $1`,
      [instanceId]
    );

    const allDone = allTasksResult.rows.length > 0 && allTasksResult.rows.every((t: any) => t.status === "done");

    if (allDone) {
      await pool.query(
        `UPDATE wf_instances SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [instanceId]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
         VALUES ($1, 'instance', $2, 'auto_completed', $3)`,
        [orgId, instanceId, JSON.stringify({ reason: "All tasks completed" })]
      );
    }

    return NextResponse.json({
      success: true,
      task,
      instanceAutoCompleted: allDone,
    });
  } catch (err) {
    console.error("Task update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}
