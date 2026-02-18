/**
 * GET /api/hr/workflows — active HR workflows with steps for current org/site (Engine v1 shape).
 * POST /api/hr/workflows — create workflow + steps (admin/HR only).
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CATEGORIES = ["employment", "onboarding", "compliance", "offboarding"] as const;
const TRIGGER_TYPES = ["manual", "on_employee_created", "on_role_assigned", "on_contract_end", "on_expiry"] as const;
const STEP_TYPES = ["task", "document", "compliance_check", "approval"] as const;

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, activeSiteId } = org;
  try {
    const rows = await pool.query(
      `SELECT w.id AS workflow_id, w.code, w.name, w.description, w.category, w.trigger_type, w.role_scope, w.is_active, w.created_at,
              s.id AS step_id, s.code AS step_code, s.name AS step_name, s.step_order, s.default_due_days, s.required, s.step_type, s.order_index
       FROM hr_workflows w
       LEFT JOIN hr_workflow_steps s ON s.workflow_id = w.id
       WHERE w.org_id = $1 AND w.is_active = true
         AND ($2::uuid IS NULL OR w.site_id IS NULL OR w.site_id = $2)
       ORDER BY w.code, COALESCE(s.order_index, s.step_order) NULLS LAST`,
      [activeOrgId, activeSiteId]
    );

    const byWorkflow = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        description: string | null;
        category: string | null;
        trigger_type: string | null;
        role_scope: string | null;
        is_active: boolean;
        created_at: string | null;
        steps: Array<{
          id: string;
          code: string;
          name: string;
          order: number;
          defaultDueDays: number | null;
          required: boolean;
          step_type: string | null;
          order_index: number | null;
        }>;
      }
    >();
    for (const row of rows.rows) {
      const key = row.workflow_id;
      if (!byWorkflow.has(key)) {
        byWorkflow.set(key, {
          id: row.workflow_id,
          code: row.code,
          name: row.name,
          description: row.description ?? null,
          category: row.category ?? null,
          trigger_type: row.trigger_type ?? null,
          role_scope: row.role_scope ?? null,
          is_active: row.is_active ?? true,
          created_at: row.created_at ?? null,
          steps: [],
        });
      }
      if (row.step_id != null) {
        byWorkflow.get(key)!.steps.push({
          id: row.step_id,
          code: row.step_code,
          name: row.step_name,
          order: row.step_order ?? 0,
          defaultDueDays: row.default_due_days ?? null,
          required: row.required ?? true,
          step_type: row.step_type ?? null,
          order_index: row.order_index ?? null,
        });
      }
    }
    const workflows = [...byWorkflow.values()];
    const res = NextResponse.json(workflows);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|connect ECONNREFUSED|Missing DATABASE_URL/i.test(message)) {
      const res = NextResponse.json([]);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch workflows" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: {
    name: string;
    code?: string;
    description?: string;
    category?: string;
    trigger_type?: string;
    role_scope?: string;
    is_active?: boolean;
    steps?: Array<{
      title: string;
      description?: string;
      step_type?: string;
      is_required?: boolean;
      due_offset_days?: number;
      order_index?: number;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    const res = NextResponse.json({ error: "name is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const code = typeof body.code === "string" ? body.code.trim() : name.toUpperCase().replace(/\s+/g, "_").slice(0, 64);
  const category = body.category && CATEGORIES.includes(body.category as (typeof CATEGORIES)[number]) ? body.category : null;
  const triggerType = body.trigger_type && TRIGGER_TYPES.includes(body.trigger_type as (typeof TRIGGER_TYPES)[number]) ? body.trigger_type : "manual";
  const roleScope = typeof body.role_scope === "string" ? body.role_scope.trim() || null : null;
  const isActive = body.is_active !== false;
  const steps = Array.isArray(body.steps) ? body.steps : [];

  const { data: workflow, error: wfErr } = await supabase
    .from("hr_workflows")
    .insert({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId ?? null,
      code,
      name,
      description: body.description?.trim() || null,
      category,
      trigger_type: triggerType,
      role_scope: roleScope,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (wfErr) {
    if (wfErr.code === "23505") {
      const res = NextResponse.json({ error: "Workflow code already exists for this org" }, { status: 409 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    console.error("[hr/workflows] insert error:", wfErr);
    const res = NextResponse.json({ error: wfErr.message }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const workflowId = workflow.id;
  if (steps.length > 0) {
    const stepRows = steps.map((s, i) => {
      const order = s.order_index ?? i;
      const stepType = s.step_type && STEP_TYPES.includes(s.step_type as (typeof STEP_TYPES)[number]) ? s.step_type : "task";
      return {
        org_id: org.activeOrgId,
        workflow_id: workflowId,
        step_order: order,
        order_index: order,
        code: `step_${order}`,
        name: typeof s.title === "string" ? s.title : `Step ${order + 1}`,
        description: s.description?.trim() || null,
        default_due_days: s.due_offset_days ?? null,
        required: s.is_required !== false,
        step_type: stepType,
      };
    });
    const { error: stepsErr } = await supabase.from("hr_workflow_steps").insert(stepRows);
    if (stepsErr) {
      console.error("[hr/workflows] steps insert error:", stepsErr);
    }
  }

  const res = NextResponse.json({ ok: true, id: workflowId, code, name });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
