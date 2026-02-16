/**
 * POST /api/hr/workflows/upsert — create or update HR workflow template and steps (admin/HR only).
 * Body: { code: string, name: string, description?: string, steps?: Step[] }
 * Step: { title: string, owner?: "Ops"|"Supervisor"|"HR", eta_days?: number, description?: string, evidence_required?: boolean, code?: string }
 * Upserts workflow by (org_id, code); replaces all steps for that workflow. Returns 403 for non-admin/non-hr.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_OWNERS = ["Ops", "Supervisor", "HR"] as const;

type StepInput = {
  title?: string;
  owner?: string;
  eta_days?: number;
  description?: string;
  evidence_required?: boolean;
  code?: string;
};

function normalizeStep(step: StepInput, index: number): { code: string; name: string; description: string | null; default_due_days: number; required: boolean; owner_role: string; evidence_required: boolean } | null {
  const name = typeof step.title === "string" ? step.title.trim() : "";
  if (!name) return null;
  const code = typeof step.code === "string" && step.code.trim()
    ? step.code.trim()
    : `step_${index + 1}`;
  const owner = step.owner && VALID_OWNERS.includes(step.owner as (typeof VALID_OWNERS)[number])
    ? step.owner
    : "HR";
  const eta_days = typeof step.eta_days === "number" && step.eta_days >= 0 ? step.eta_days : 7;
  const description = step.description !== undefined && step.description !== null
    ? (typeof step.description === "string" ? step.description.trim() : null)
    : null;
  const evidence_required = Boolean(step.evidence_required);
  return {
    code,
    name,
    description,
    default_due_days: eta_days,
    required: true,
    owner_role: owner,
    evidence_required,
  };
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, userId } = org;

  const roleResult = await pool.query(
    `SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
    [userId, activeOrgId]
  );
  const role = roleResult.rows[0]?.role as string | undefined;
  if (!role || (role !== "admin" && role !== "hr")) {
    const res = NextResponse.json(
      { error: "Only admins and HR can create or edit templates" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { code?: string; name?: string; description?: string; steps?: StepInput[] };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    body.description !== undefined && body.description !== null
      ? (typeof body.description === "string" ? body.description.trim() : "")
      : null;

  if (!code) {
    const res = NextResponse.json({ error: "code is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!name) {
    const res = NextResponse.json({ error: "name is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const stepsInput = Array.isArray(body.steps) ? body.steps : [];
  const steps = stepsInput
    .map((s, i) => normalizeStep(s, i))
    .filter((s): s is NonNullable<typeof s> => s != null);

  const client = await pool.connect();
  try {
    const upsertResult = await client.query(
      `INSERT INTO hr_workflows (org_id, code, name, description, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (org_id, code)
       DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()
       RETURNING id, code, name, description`,
      [activeOrgId, code, name, description || null]
    );
    const row = upsertResult.rows[0];
    const workflowId = row.id as string;

    await client.query(
      `DELETE FROM hr_workflow_steps WHERE workflow_id = $1`,
      [workflowId]
    );

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await client.query(
        `INSERT INTO hr_workflow_steps (org_id, workflow_id, step_order, code, name, description, default_due_days, required, owner_role, evidence_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          activeOrgId,
          workflowId,
          i + 1,
          s.code,
          s.name,
          s.description,
          s.default_due_days,
          s.required,
          s.owner_role,
          s.evidence_required,
        ]
      );
    }

    const res = NextResponse.json({
      success: true,
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      stepsSaved: steps.length,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hr/workflows/upsert]", err);
    const res = NextResponse.json(
      { error: /duplicate|unique|constraint/i.test(message) ? "A template with this code already exists" : "Failed to save template" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  } finally {
    client.release();
  }
}
