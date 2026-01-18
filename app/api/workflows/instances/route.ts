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

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    
    let query = `
      SELECT i.id, i.template_id, i.employee_id, i.employee_name, 
             i.status, i.start_date, i.due_date, i.completed_at, i.created_at,
             i.shift_date, i.shift_type, i.area_code,
             t.name as template_name, t.category as template_category
      FROM wf_instances i
      LEFT JOIN wf_templates t ON t.id = i.template_id
      WHERE i.org_id = $1
    `;
    const params: any[] = [orgId];

    if (status && status !== "all") {
      query += ` AND i.status = $2`;
      params.push(status);
    }
    query += ` ORDER BY i.created_at DESC`;

    const instancesResult = await pool.query(query, params);

    const instances = await Promise.all(
      instancesResult.rows.map(async (inst) => {
        const tasksResult = await pool.query(
          `SELECT status FROM wf_instance_tasks WHERE instance_id = $1`,
          [inst.id]
        );
        const totalTasks = tasksResult.rows.length;
        const doneTasks = tasksResult.rows.filter((t: any) => t.status === "done").length;

        return {
          id: inst.id,
          templateId: inst.template_id,
          templateName: inst.template_name || "Unknown",
          templateCategory: inst.template_category || "general",
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
          progress: {
            total: totalTasks,
            done: doneTasks,
            percent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
          },
        };
      })
    );

    const countResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
       FROM wf_instances WHERE org_id = $1`,
      [orgId]
    );
    
    const statusCounts = {
      active: parseInt(countResult.rows[0]?.active || 0),
      completed: parseInt(countResult.rows[0]?.completed || 0),
      cancelled: parseInt(countResult.rows[0]?.cancelled || 0),
    };

    return NextResponse.json({ instances, statusCounts });
  } catch (err) {
    console.error("Instances error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch instances" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { templateId, employeeId, employeeName, startDate, shiftDate, shiftType, areaCode } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 }
      );
    }

    const templateResult = await pool.query(
      `SELECT id, name FROM wf_templates WHERE id = $1 AND org_id = $2`,
      [templateId, orgId]
    );

    if (templateResult.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const template = templateResult.rows[0];

    const stepsResult = await pool.query(
      `SELECT step_no, title, description, owner_role, default_due_days, required 
       FROM wf_template_steps 
       WHERE template_id = $1 
       ORDER BY step_no`,
      [templateId]
    );

    const steps = stepsResult.rows;
    const start = startDate ? new Date(startDate) : new Date();
    const maxDueDays = steps.length > 0 ? Math.max(...steps.map((s: any) => s.default_due_days)) : 30;
    const dueDate = new Date(start.getTime() + maxDueDays * 24 * 60 * 60 * 1000);

    const instanceResult = await pool.query(
      `INSERT INTO wf_instances (org_id, template_id, employee_id, employee_name, status, start_date, due_date, shift_date, shift_type, area_code)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        orgId, 
        templateId, 
        employeeId || null, 
        employeeName || null, 
        start.toISOString().split("T")[0], 
        dueDate.toISOString().split("T")[0],
        shiftDate || null,
        shiftType || null,
        areaCode || null
      ]
    );

    const instanceId = instanceResult.rows[0].id;

    for (const step of steps) {
      const taskDueDate = new Date(start.getTime() + step.default_due_days * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO wf_instance_tasks (instance_id, step_no, title, description, owner_role, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'todo')`,
        [instanceId, step.step_no, step.title, step.description, step.owner_role, taskDueDate.toISOString().split("T")[0]]
      );
    }

    await pool.query(
      `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
       VALUES ($1, 'instance', $2, 'created', $3)`,
      [orgId, instanceId, JSON.stringify({ templateId, templateName: template.name, employeeId, employeeName, taskCount: steps.length })]
    );

    return NextResponse.json({
      success: true,
      instance: {
        id: instanceId,
        templateName: template.name,
        employeeName,
        status: "active",
        taskCount: steps.length,
      },
    });
  } catch (err) {
    console.error("Instance creation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create instance" },
      { status: 500 }
    );
  }
}
