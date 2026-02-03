import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { isPilotMode } from "@/lib/pilotMode";
import { getOrgIdFromSession } from "@/lib/orgSession";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (isPilotMode()) {
    return NextResponse.json(
      { ok: false, error: "pilot_mode_blocked", message: "Pilot mode: use /api/hr/* and /app/hr/*" },
      { status: 403 }
    );
  }
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { orgId } = session;

    const result = await pool.query(`
      SELECT 
        t.id,
        t.instance_id,
        t.step_order,
        t.title,
        t.description,
        t.owner_role,
        t.owner_user_id,
        t.due_date,
        t.status,
        t.notes,
        t.evidence_url,
        t.completed_at,
        i.employee_name,
        i.status as instance_status,
        i.area_code,
        wt.name as template_name,
        wt.category as template_category
      FROM wf_instance_tasks t
      JOIN wf_instances i ON i.id = t.instance_id
      LEFT JOIN wf_templates wt ON wt.id = i.template_id
      WHERE i.org_id = $1
        AND i.status = 'active'
        AND t.status != 'done'
      ORDER BY 
        CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
        t.due_date ASC NULLS LAST,
        t.step_order ASC
    `, [orgId]);

    type TaskRow = {
      id: string;
      instance_id: string;
      step_order: number;
      title: string;
      description: string | null;
      owner_role: string;
      owner_user_id: string | null;
      due_date: string | null;
      status: string;
      notes: string | null;
      evidence_url: string | null;
      completed_at: string | null;
      employee_name: string | null;
      instance_status: string;
      area_code: string | null;
      template_name: string | null;
      template_category: string | null;
    };

    const tasks = result.rows.map((row: TaskRow) => {
      const isOverdue = row.due_date && new Date(row.due_date) < new Date() && row.status !== "done";
      const isDueToday = row.due_date && new Date(row.due_date).toDateString() === new Date().toDateString();
      
      return {
        id: row.id,
        instanceId: row.instance_id,
        stepOrder: row.step_order,
        title: row.title,
        description: row.description,
        ownerRole: row.owner_role,
        ownerUserId: row.owner_user_id,
        dueDate: row.due_date,
        status: row.status,
        notes: row.notes,
        evidenceUrl: row.evidence_url,
        completedAt: row.completed_at,
        employeeName: row.employee_name,
        instanceStatus: row.instance_status,
        areaCode: row.area_code,
        templateName: row.template_name,
        templateCategory: row.template_category,
        isOverdue,
        isDueToday,
      };
    });

    const overdueCount = tasks.filter((t) => t.isOverdue).length;
    const dueTodayCount = tasks.filter((t) => t.isDueToday).length;

    return NextResponse.json({
      tasks,
      summary: {
        total: tasks.length,
        overdue: overdueCount,
        dueToday: dueTodayCount,
      },
    });
  } catch (err) {
    console.error("My tasks error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
