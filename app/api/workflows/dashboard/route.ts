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

    const activeResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM wf_instances 
      WHERE org_id = $1 AND status = 'active'
    `, [orgId]);

    const overdueResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM wf_instance_tasks t
      JOIN wf_instances i ON i.id = t.instance_id
      WHERE i.org_id = $1 
        AND i.status = 'active'
        AND t.status != 'done'
        AND t.due_date < CURRENT_DATE
    `, [orgId]);

    const byTemplateResult = await pool.query(`
      SELECT 
        wt.name as template_name,
        wt.category,
        COUNT(i.id) as count
      FROM wf_instances i
      LEFT JOIN wf_templates wt ON wt.id = i.template_id
      WHERE i.org_id = $1 AND i.status = 'active'
      GROUP BY wt.name, wt.category
      ORDER BY count DESC
    `, [orgId]);

    const recentResult = await pool.query(`
      SELECT 
        i.id,
        i.employee_name,
        i.status,
        i.start_date,
        i.due_date,
        i.updated_at,
        i.area_code,
        wt.name as template_name,
        wt.category as template_category,
        (SELECT COUNT(*) FROM wf_instance_tasks WHERE instance_id = i.id) as total_tasks,
        (SELECT COUNT(*) FROM wf_instance_tasks WHERE instance_id = i.id AND status = 'done') as done_tasks
      FROM wf_instances i
      LEFT JOIN wf_templates wt ON wt.id = i.template_id
      WHERE i.org_id = $1
      ORDER BY i.updated_at DESC
      LIMIT 10
    `, [orgId]);

    const completedTodayResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM wf_instances 
      WHERE org_id = $1 
        AND status = 'completed'
        AND completed_at::date = CURRENT_DATE
    `, [orgId]);

    return NextResponse.json({
      activeWorkflows: parseInt(activeResult.rows[0].count),
      overdueTasks: parseInt(overdueResult.rows[0].count),
      completedToday: parseInt(completedTodayResult.rows[0].count),
      byTemplate: byTemplateResult.rows.map((row: any) => ({
        templateName: row.template_name || "Unknown",
        category: row.category,
        count: parseInt(row.count),
      })),
      recentInstances: recentResult.rows.map((row: any) => ({
        id: row.id,
        employeeName: row.employee_name,
        status: row.status,
        startDate: row.start_date,
        dueDate: row.due_date,
        updatedAt: row.updated_at,
        areaCode: row.area_code,
        templateName: row.template_name,
        templateCategory: row.template_category,
        progress: {
          total: parseInt(row.total_tasks),
          done: parseInt(row.done_tasks),
          percent: row.total_tasks > 0 ? Math.round((parseInt(row.done_tasks) / parseInt(row.total_tasks)) * 100) : 0,
        },
      })),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
