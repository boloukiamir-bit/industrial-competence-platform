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

    const result = await pool.query(`
      SELECT 
        t.id,
        t.instance_id,
        t.step_no,
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
        t.step_no
    `, [orgId]);

    const tasks = result.rows.map((row: any) => {
      const isOverdue = row.due_date && new Date(row.due_date) < new Date() && row.status !== "done";
      const isDueToday = row.due_date && new Date(row.due_date).toDateString() === new Date().toDateString();
      
      return {
        id: row.id,
        instanceId: row.instance_id,
        stepNo: row.step_no,
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

    const overdueCount = tasks.filter((t: any) => t.isOverdue).length;
    const dueTodayCount = tasks.filter((t: any) => t.isDueToday).length;

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
