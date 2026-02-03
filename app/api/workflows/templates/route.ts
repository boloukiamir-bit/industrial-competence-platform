import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { isPilotMode } from "@/lib/pilotMode";
import { getOrgIdFromSession, isAdminOrHr } from "@/lib/orgSession";

export const runtime = "nodejs";

const VALID_CATEGORIES = ["Production", "Safety", "HR", "Quality", "Maintenance", "Competence", "Onboarding", "Offboarding", "Medical", "Contract"];
const VALID_OWNER_ROLES = ["HR", "Supervisor", "IT", "Quality", "Maintenance", "Employee"];

/** Fetch steps for a template; supports step_no (migration schema) or step_order (legacy schema). */
async function fetchWfTemplateSteps(templateId: string) {
  const withStepNo = `SELECT id, step_no AS step_order, title, owner_role, COALESCE(default_due_days, 3)::int AS default_due_days, required FROM wf_template_steps WHERE template_id = $1 ORDER BY step_no`;
  const withStepOrder = `SELECT id, step_order, title, owner_role, 3 AS default_due_days, required FROM wf_template_steps WHERE template_id = $1 ORDER BY step_order`;
  try {
    const r = await pool.query(withStepNo, [templateId]);
    return r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/step_no|step_order|default_due_days/.test(msg)) {
      const r = await pool.query(withStepOrder, [templateId]);
      return r.rows;
    }
    throw e;
  }
}

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

    const templatesResult = await pool.query(
      `SELECT id, name, description, category, is_active, created_at 
       FROM wf_templates 
       WHERE org_id = $1 AND is_active = true 
       ORDER BY name`,
      [orgId]
    );

    const templates = await Promise.all(
      templatesResult.rows.map(async (template) => {
        const steps = await fetchWfTemplateSteps(template.id);
        return {
          ...template,
          stepCount: steps.length,
          steps,
        };
      })
    );

    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Templates error:", err);
    // In Vercel/serverless, missing DATABASE_URL or missing table: return empty so page loads
    const isDbConfigOrMissingTable =
      /DATABASE_URL not configured|relation .* does not exist|connect ECONNREFUSED|connection|Missing DATABASE_URL/i.test(message);
    if (isDbConfigOrMissingTable) {
      return NextResponse.json({ templates: [] });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

type StepInput = {
  step_order: number;
  title: string;
  description?: string;
  owner_role: string;
  default_due_days: number;
  required: boolean;
};

export async function POST(request: NextRequest) {
  if (isPilotMode()) {
    return NextResponse.json(
      { ok: false, error: "pilot_mode_blocked", message: "Pilot mode: use /api/hr/* and /app/hr/*" },
      { status: 403 }
    );
  }
  const client = await pool.connect();
  
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { orgId, role, userId } = session;

    if (!isAdminOrHr(role)) {
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
      if (step.step_order !== i + 1) {
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
        `INSERT INTO wf_template_steps (template_id, step_order, title, description, owner_role, default_due_days, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          templateId,
          step.step_order,
          step.title.trim(),
          step.description?.trim() || null,
          step.owner_role,
          step.default_due_days || 0,
          step.required ?? false,
        ]
      );
    }

    await client.query(
      `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
       VALUES ($1, 'template', $2, 'created', $3, $4)`,
      [orgId, templateId, userId, JSON.stringify({ name, category, stepCount: steps.length })]
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
