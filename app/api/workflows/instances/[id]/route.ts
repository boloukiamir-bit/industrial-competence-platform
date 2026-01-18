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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const instanceResult = await pool.query(
      `SELECT i.id, i.template_id, i.employee_id, i.employee_name, 
              i.status, i.start_date, i.due_date, i.completed_at, i.created_at,
              i.shift_date, i.shift_type, i.area_code,
              t.name as template_name, t.description as template_description, t.category as template_category
       FROM wf_instances i
       LEFT JOIN wf_templates t ON t.id = i.template_id
       WHERE i.id = $1 AND i.org_id = $2`,
      [id, orgId]
    );

    if (instanceResult.rows.length === 0) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const inst = instanceResult.rows[0];

    const tasksResult = await pool.query(
      `SELECT id, step_no, title, description, owner_role, owner_user_id, 
              due_date, status, completed_at, completed_by
       FROM wf_instance_tasks 
       WHERE instance_id = $1 
       ORDER BY step_no`,
      [id]
    );

    const auditResult = await pool.query(
      `SELECT id, action, actor_email, metadata, created_at 
       FROM wf_audit_log 
       WHERE entity_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [id]
    );

    const tasks = tasksResult.rows;
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t: any) => t.status === "done").length;

    return NextResponse.json({
      id: inst.id,
      templateId: inst.template_id,
      templateName: inst.template_name || "Unknown",
      templateDescription: inst.template_description,
      templateCategory: inst.template_category,
      employeeId: inst.employee_id,
      employeeName: inst.employee_name,
      shiftDate: inst.shift_date,
      shiftType: inst.shift_type,
      areaCode: inst.area_code,
      status: inst.status,
      startDate: inst.start_date,
      dueDate: inst.due_date,
      completedAt: inst.completed_at,
      createdAt: inst.created_at,
      tasks,
      progress: {
        total: totalTasks,
        done: doneTasks,
        percent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      auditLog: auditResult.rows,
    });
  } catch (err) {
    console.error("Instance error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch instance" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["active", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const completedAt = status === "completed" ? new Date().toISOString() : null;

    const result = await pool.query(
      `UPDATE wf_instances 
       SET status = $1, completed_at = $2, updated_at = NOW()
       WHERE id = $3 AND org_id = $4
       RETURNING id, status`,
      [status, completedAt, id, orgId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    await pool.query(
      `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
       VALUES ($1, 'instance', $2, $3, $4)`,
      [orgId, id, `status_changed_to_${status}`, JSON.stringify({ newStatus: status })]
    );

    return NextResponse.json({ success: true, instance: result.rows[0] });
  } catch (err) {
    console.error("Instance update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update instance" },
      { status: 500 }
    );
  }
}
