import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
export const runtime = "nodejs";
import { getOrgIdFromSession } from "@/lib/orgSession";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { orgId } = session;

    const templateResult = await pool.query(
      `SELECT id, name, description, category, is_active, created_at 
       FROM wf_templates 
       WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );

    if (templateResult.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const template = templateResult.rows[0];

    const stepsResult = await pool.query(
      `SELECT id, step_no, title, description, owner_role, default_due_days, required 
       FROM wf_template_steps 
       WHERE template_id = $1 
       ORDER BY step_no`,
      [id]
    );

    return NextResponse.json({
      ...template,
      steps: stepsResult.rows,
    });
  } catch (err) {
    console.error("Template error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch template" },
      { status: 500 }
    );
  }
}
