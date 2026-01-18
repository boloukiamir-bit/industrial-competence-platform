import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pgClient";
import { PoolClient } from "pg";
import { getOrgIdFromSession, isAdminOrHr } from "@/lib/orgSession";

export async function POST(request: NextRequest) {
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { orgId, role, userId } = session;

    if (!isAdminOrHr(role)) {
      return NextResponse.json({ error: "Only admins and HR can seed templates" }, { status: 403 });
    }

    const existingResult = await pool.query(
      `SELECT COUNT(*) as count FROM wf_templates WHERE org_id = $1`,
      [orgId]
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      return NextResponse.json({ 
        error: "Templates already exist for this organization. Use force=true to replace them.",
        existingCount: parseInt(existingResult.rows[0].count)
      }, { status: 409 });
    }

    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");

      const templateId1 = await seedTemplate(client, orgId, {
        name: "Cross-training Workflow",
        description: "Start cross-training for an employee to address skill gaps at a critical station",
        category: "Competence",
        steps: [
          { step_no: 1, title: "Identify training needs", description: "Assess current skill level and define target competence", owner_role: "Supervisor", default_due_days: 2, required: true },
          { step_no: 2, title: "Assign trainer/mentor", description: "Select experienced employee to provide training", owner_role: "Supervisor", default_due_days: 3, required: true },
          { step_no: 3, title: "Create training schedule", description: "Plan training sessions and timeline", owner_role: "HR", default_due_days: 5, required: true },
          { step_no: 4, title: "Conduct training", description: "Employee completes hands-on training at station", owner_role: "Supervisor", default_due_days: 14, required: true },
          { step_no: 5, title: "Assess competence", description: "Evaluate employee skill level after training", owner_role: "Supervisor", default_due_days: 2, required: true },
          { step_no: 6, title: "Update skill matrix", description: "Record new competence level in system", owner_role: "HR", default_due_days: 1, required: true },
        ],
      });

      const templateId2 = await seedTemplate(client, orgId, {
        name: "Onboarding - New Employee",
        description: "Standard onboarding process for new employees",
        category: "HR",
        steps: [
          { step_no: 1, title: "Prepare workstation", description: "Set up computer, desk, and access cards", owner_role: "HR", default_due_days: 1, required: true },
          { step_no: 2, title: "IT account setup", description: "Create email, system accounts, and permissions", owner_role: "IT", default_due_days: 2, required: true },
          { step_no: 3, title: "Safety training", description: "Complete mandatory safety orientation", owner_role: "Supervisor", default_due_days: 3, required: true },
          { step_no: 4, title: "Equipment training", description: "Train on primary equipment and tools", owner_role: "Supervisor", default_due_days: 7, required: true },
          { step_no: 5, title: "Meet the team", description: "Introduction to team members and key contacts", owner_role: "Supervisor", default_due_days: 3, required: true },
          { step_no: 6, title: "HR documentation", description: "Complete all employment paperwork", owner_role: "HR", default_due_days: 5, required: true },
          { step_no: 7, title: "First week check-in", description: "Manager check-in after first week", owner_role: "Supervisor", default_due_days: 7, required: true },
          { step_no: 8, title: "30-day review", description: "Performance review at 30 days", owner_role: "Supervisor", default_due_days: 30, required: true },
        ],
      });

      const templateId3 = await seedTemplate(client, orgId, {
        name: "Incident Response",
        description: "Handle and follow up on safety incidents and near-misses",
        category: "Safety",
        steps: [
          { step_no: 1, title: "Incident report", description: "Document incident details and immediate response", owner_role: "Supervisor", default_due_days: 0, required: true },
          { step_no: 2, title: "Root cause analysis", description: "Investigate and identify root causes", owner_role: "Supervisor", default_due_days: 3, required: true },
          { step_no: 3, title: "Corrective actions", description: "Define and implement corrective measures", owner_role: "Supervisor", default_due_days: 7, required: true },
          { step_no: 4, title: "Follow-up verification", description: "Verify corrective actions are effective", owner_role: "Supervisor", default_due_days: 14, required: true },
          { step_no: 5, title: "Close case", description: "Document outcomes and close case", owner_role: "HR", default_due_days: 1, required: true },
        ],
      });

      await client.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
         VALUES ($1, 'setup', $2, 'templates_seeded', $3, $4)`,
        [orgId, orgId, userId, JSON.stringify({ templateCount: 3, templateIds: [templateId1, templateId2, templateId3] })]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Templates seeded successfully",
        templates: [
          { id: templateId1, name: "Cross-training Workflow" },
          { id: templateId2, name: "Onboarding - New Employee" },
          { id: templateId3, name: "Incident Response" },
        ],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to seed templates" },
      { status: 500 }
    );
  }
}

type TemplateInput = {
  name: string;
  description: string;
  category: string;
  steps: {
    step_no: number;
    title: string;
    description: string;
    owner_role: string;
    default_due_days: number;
    required: boolean;
  }[];
};

async function seedTemplate(client: PoolClient, orgId: string, template: TemplateInput): Promise<string> {
  const result = await client.query(
    `INSERT INTO wf_templates (org_id, name, description, category, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [orgId, template.name, template.description, template.category]
  );

  const templateId = result.rows[0].id;

  for (const step of template.steps) {
    await client.query(
      `INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [templateId, step.step_no, step.title, step.description, step.owner_role, step.default_due_days, step.required]
    );
  }

  return templateId;
}
