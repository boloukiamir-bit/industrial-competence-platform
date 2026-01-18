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

const VALID_CATEGORIES = ["Production", "Safety", "HR", "Quality", "Maintenance", "Competence"];
const VALID_OWNER_ROLES = ["HR", "Supervisor", "IT", "Quality", "Maintenance", "Employee"];

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

type StepInput = {
  step_no: number;
  title: string;
  description?: string;
  owner_role: string;
  default_due_days: number;
  required: boolean;
};

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Check that org has at least one admin/hr member who could create templates
    // NOTE: In production, this should verify the authenticated user's role via session.
    // For demo, we check that the org exists and has admin/hr members.
    const membershipResult = await client.query(
      `SELECT role FROM memberships WHERE org_id = $1 AND is_active = true AND role IN ('admin', 'hr') LIMIT 1`,
      [orgId]
    );
    
    if (membershipResult.rows.length === 0) {
      return NextResponse.json({ error: "Only admins and HR can create templates" }, { status: 403 });
    }

    const body = await request.json();
    const { name, category, description, steps } = body as {
      name: string;
      category: string;
      description?: string;
      steps: StepInput[];
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "At least one step is required" }, { status: 400 });
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.title || !step.title.trim()) {
        return NextResponse.json({ error: `Step ${i + 1} title is required` }, { status: 400 });
      }
      if (!step.owner_role || !VALID_OWNER_ROLES.includes(step.owner_role)) {
        return NextResponse.json({ error: `Step ${i + 1} owner_role must be one of: ${VALID_OWNER_ROLES.join(", ")}` }, { status: 400 });
      }
      if (step.step_no !== i + 1) {
        return NextResponse.json({ error: "Step numbers must be continuous starting from 1" }, { status: 400 });
      }
      if (typeof step.default_due_days !== "number" || step.default_due_days < 0) {
        return NextResponse.json({ error: `Step ${i + 1} due days must be a non-negative number` }, { status: 400 });
      }
    }

    await client.query("BEGIN");

    const templateResult = await client.query(
      `INSERT INTO wf_templates (org_id, name, description, category, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [orgId, name.trim(), description?.trim() || null, category]
    );

    const templateId = templateResult.rows[0].id;

    for (const step of steps) {
      await client.query(
        `INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          templateId,
          step.step_no,
          step.title.trim(),
          step.description?.trim() || null,
          step.owner_role,
          step.default_due_days || 0,
          step.required ?? false,
        ]
      );
    }

    await client.query(
      `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, metadata)
       VALUES ($1, 'template', $2, 'created', $3)`,
      [orgId, templateId, JSON.stringify({ name, category, stepCount: steps.length })]
    );

    await client.query("COMMIT");

    return NextResponse.json({ 
      success: true, 
      templateId,
      message: "Template created successfully" 
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create template error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create template" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
