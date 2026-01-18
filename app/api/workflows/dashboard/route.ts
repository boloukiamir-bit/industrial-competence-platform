import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";
import { getOrgIdFromSession } from "@/lib/orgSession";

export async function GET(request: NextRequest) {
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { orgId } = session;

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

    type InstanceRow = {
      id: string;
      employee_name: string | null;
      status: string;
      start_date: string;
      due_date: string;
      updated_at: string;
      area_code: string | null;
      template_name: string | null;
      template_category: string | null;
      total_tasks: string;
      done_tasks: string;
    };

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
      byTemplate: byTemplateResult.rows.map((row: { template_name: string | null; category: string | null; count: string }) => ({
        templateName: row.template_name || "Unknown",
        category: row.category,
        count: parseInt(row.count),
      })),
      recentInstances: recentResult.rows.map((row: InstanceRow) => ({
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
          percent: parseInt(row.total_tasks) > 0 ? Math.round((parseInt(row.done_tasks) / parseInt(row.total_tasks)) * 100) : 0,
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
