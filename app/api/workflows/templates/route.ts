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

    const templatesResult = await pool.query(
      `SELECT id, name, description, category, is_active, created_at 
       FROM wf_templates 
       WHERE org_id = $1 AND is_active = true 
       ORDER BY name`,
      [orgId]
    );

    const templates = await Promise.all(
      templatesResult.rows.map(async (template) => {
        const stepsResult = await pool.query(
          `SELECT id, step_no, title, owner_role, default_due_days, required 
           FROM wf_template_steps 
           WHERE template_id = $1 
           ORDER BY step_no`,
          [template.id]
        );
        return {
          ...template,
          stepCount: stepsResult.rows.length,
          steps: stepsResult.rows,
        };
      })
    );

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("Templates error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
