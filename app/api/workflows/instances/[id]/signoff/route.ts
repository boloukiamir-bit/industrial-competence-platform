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

export async function POST(
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
      allTasksResult.rows.every((t: any) => t.status === "done");

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
             supervisor_signed_by = gen_random_uuid(),
             supervisor_comment = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [comment || null, instanceId]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
         VALUES ($1, 'instance', $2, 'supervisor_signoff', $3)`,
        [orgId, instanceId, JSON.stringify({ comment })]
      );

      if (!instance.requires_hr_signoff) {
        await pool.query(
          `UPDATE wf_instances 
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [instanceId]
        );

        await pool.query(
          `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
           VALUES ($1, 'instance', $2, 'completed', $3)`,
          [orgId, instanceId, JSON.stringify({ reason: "Supervisor sign-off complete" })]
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
             hr_signed_by = gen_random_uuid(),
             hr_comment = $1,
             status = 'completed',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [comment || null, instanceId]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
         VALUES ($1, 'instance', $2, 'hr_signoff', $3)`,
        [orgId, instanceId, JSON.stringify({ comment })]
      );

      await pool.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
         VALUES ($1, 'instance', $2, 'completed', $3)`,
        [orgId, instanceId, JSON.stringify({ reason: "HR sign-off complete" })]
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
