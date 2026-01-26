import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
export const runtime = "nodejs";
import { getOrgIdFromSession } from "@/lib/orgSession";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params;
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { orgId, userId } = session;

    const body = await request.json();
    const { type, comment } = body;

    if (!type || !["supervisor", "hr"].includes(type)) {
      return NextResponse.json({ error: "Invalid sign-off type" }, { status: 400 });
    }

    const instanceResult = await pool.query(
      `SELECT id, org_id, status, supervisor_signed_at, hr_signed_at, requires_hr_signoff
       FROM wf_instances WHERE id = $1 AND org_id = $2`,
      [instanceId, orgId]
    );

    if (instanceResult.rows.length === 0) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const instance = instanceResult.rows[0];

    if (instance.status !== "active") {
      return NextResponse.json({ error: "Instance is not active" }, { status: 400 });
    }

    const allTasksResult = await pool.query(
      `SELECT status FROM wf_instance_tasks WHERE instance_id = $1`,
      [instanceId]
    );

    const allDone = allTasksResult.rows.length > 0 && 
      allTasksResult.rows.every((t: { status: string }) => t.status === "done");

    if (!allDone) {
      return NextResponse.json({ error: "All tasks must be completed before sign-off" }, { status: 400 });
    }

    if (type === "supervisor") {
      if (instance.supervisor_signed_at) {
        return NextResponse.json({ error: "Supervisor has already signed off" }, { status: 400 });
      }

      await pool.query(
        `UPDATE wf_instances 
         SET supervisor_signed_at = NOW(), 
             supervisor_signed_by = $1,
             supervisor_comment = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [userId, comment || null, instanceId]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
         VALUES ($1, 'instance', $2, 'supervisor_signoff', $3, $4)`,
        [orgId, instanceId, userId, JSON.stringify({ comment })]
      );

      if (!instance.requires_hr_signoff) {
        await pool.query(
          `UPDATE wf_instances 
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [instanceId]
        );

        await pool.query(
          `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
           VALUES ($1, 'instance', $2, 'completed', $3, $4)`,
          [orgId, instanceId, userId, JSON.stringify({ reason: "Supervisor sign-off complete" })]
        );
      }
    } else if (type === "hr") {
      if (!instance.supervisor_signed_at) {
        return NextResponse.json({ error: "Supervisor must sign off first" }, { status: 400 });
      }

      if (instance.hr_signed_at) {
        return NextResponse.json({ error: "HR has already signed off" }, { status: 400 });
      }

      await pool.query(
        `UPDATE wf_instances 
         SET hr_signed_at = NOW(), 
             hr_signed_by = $1,
             hr_comment = $2,
             status = 'completed',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [userId, comment || null, instanceId]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
         VALUES ($1, 'instance', $2, 'hr_signoff', $3, $4)`,
        [orgId, instanceId, userId, JSON.stringify({ comment })]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
         VALUES ($1, 'instance', $2, 'completed', $3, $4)`,
        [orgId, instanceId, userId, JSON.stringify({ reason: "HR sign-off complete" })]
      );
    }

    return NextResponse.json({ success: true, type });
  } catch (err) {
    console.error("Sign-off error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign off" },
      { status: 500 }
    );
  }
}
