import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { isPilotMode } from "@/lib/pilotMode";
import { getOrgIdFromSession, isAdminOrHr } from "@/lib/orgSession";

export const runtime = "nodejs";

type StepInput = {
  step_order: number;
  title: string;
  description?: string | null;
  owner_role: string;
  default_due_days: number;
  required: boolean;
};

const DEFAULT_TEMPLATES: {
  name: string;
  description: string;
  category: string;
  steps: Omit<StepInput, "step_order">[];
}[] = [
  {
    name: "Onboarding",
    description: "New employee onboarding checklist",
    category: "Onboarding",
    steps: [
      { title: "Create account / access (AD/Email/Systems)", owner_role: "IT", default_due_days: 1, required: true },
      { title: "Safety induction / site intro", owner_role: "Supervisor", default_due_days: 1, required: true },
      { title: "Assign role + team + manager", owner_role: "HR", default_due_days: 1, required: true },
      { title: "Add required trainings (BAM Grund, Fire Safety, First Aid, HLR)", owner_role: "HR", default_due_days: 14, required: true },
      { title: "Add required medical checks if applicable", owner_role: "HR", default_due_days: 30, required: false },
    ],
  },
  {
    name: "Offboarding",
    description: "Employee offboarding checklist",
    category: "Offboarding",
    steps: [
      { title: "Revoke access (AD/Email/Systems)", owner_role: "IT", default_due_days: 1, required: true },
      { title: "Return equipment / keys", owner_role: "Supervisor", default_due_days: 1, required: true },
      { title: "Exit interview", owner_role: "HR", default_due_days: 3, required: false },
      { title: "Payroll/contract closeout", owner_role: "HR", default_due_days: 7, required: true },
    ],
  },
  {
    name: "Medical checks",
    description: "Medical examination and health check workflow",
    category: "Medical",
    steps: [
      { title: "Night shift exam (if night)", owner_role: "HR", default_due_days: 14, required: false },
      { title: "Hearing check", owner_role: "HR", default_due_days: 14, required: true },
      { title: "Vision check", owner_role: "HR", default_due_days: 14, required: true },
      { title: "Health check", owner_role: "HR", default_due_days: 14, required: true },
      { title: "Hand-intensive work exam (if applicable)", owner_role: "HR", default_due_days: 14, required: false },
      { title: "Epoxy/isocyanate exam (if exposure)", owner_role: "HR", default_due_days: 14, required: false },
    ],
  },
  {
    name: "Contract admin",
    description: "Contract start, renewal and policy acknowledgements",
    category: "Contract",
    steps: [
      { title: "Contract start/renewal checklist", owner_role: "HR", default_due_days: 7, required: true },
      { title: "Temporary employment expiry check", owner_role: "HR", default_due_days: 30, required: false },
      { title: "Policy acknowledgements (Business Ethics, I-Way if relevant)", owner_role: "HR", default_due_days: 7, required: true },
      { title: "FSC / sustainability acknowledgement (if required)", owner_role: "HR", default_due_days: 7, required: false },
    ],
  },
];

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
      return NextResponse.json(
        { error: "Only admins and HR can seed templates" },
        { status: 403 }
      );
    }

    const existing = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM wf_templates WHERE org_id = $1",
      [orgId]
    );
    const existingCount = parseInt(existing.rows[0]?.count ?? "0", 10);

    if (existingCount > 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        existingCount,
        templates: [],
      });
    }

    const created: { id: string; name: string; category: string }[] = [];

    await client.query("BEGIN");

    for (const tmpl of DEFAULT_TEMPLATES) {
      const templateResult = await client.query<{ id: string }>(
        `INSERT INTO wf_templates (org_id, name, description, category, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id`,
        [orgId, tmpl.name, tmpl.description, tmpl.category]
      );

      const templateId = templateResult.rows[0].id;

      for (let i = 0; i < tmpl.steps.length; i++) {
        const step = tmpl.steps[i];
        await client.query(
          `INSERT INTO wf_template_steps (template_id, step_order, title, description, owner_role, default_due_days, required)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            templateId,
            i + 1,
            step.title,
            step.description ?? null,
            step.owner_role,
            step.default_due_days ?? 0,
            step.required ?? true,
          ]
        );
      }

      await client.query(
        `INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
         VALUES ($1, 'template', $2, 'created', $3, $4)`,
        [
          orgId,
          templateId,
          userId,
          JSON.stringify({ name: tmpl.name, category: tmpl.category, source: "seed-defaults" }),
        ]
      );

      created.push({ id: templateId, name: tmpl.name, category: tmpl.category });
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      created: created.length,
      templates: created,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed templates error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to seed templates" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
