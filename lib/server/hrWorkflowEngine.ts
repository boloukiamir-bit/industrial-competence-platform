/**
 * HR Workflow Engine v1: assign workflows to employees and (future) evaluate triggers.
 * Tenant-isolated: org_id + site_id on all writes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignParams = {
  org_id: string;
  site_id: string | null;
  workflow_id: string;
  employee_ids: string[];
};

export type AssignResult =
  | {
      ok: true;
      assigned: number;
      skipped: number;
      created_instances: number;
    }
  | { ok: false; error: string; code?: string; status: number };

/**
 * Assign a workflow to one or more employees. Creates hr_employee_workflows and hr_employee_steps.
 * Skips employees who already have an active instance of this workflow.
 */
export async function runHrWorkflowAssign(
  supabase: SupabaseClient,
  params: AssignParams
): Promise<AssignResult> {
  const { org_id, site_id, workflow_id, employee_ids } = params;

  const { data: workflow, error: wfErr } = await supabase
    .from("hr_workflows")
    .select("id")
    .eq("id", workflow_id)
    .eq("org_id", org_id)
    .eq("is_active", true)
    .maybeSingle();

  if (wfErr) {
    console.error("[hrWorkflowEngine] workflow lookup error:", wfErr);
    return { ok: false, error: wfErr.message, status: 500 };
  }
  if (!workflow?.id) {
    return { ok: false, error: "Workflow not found or inactive", code: "not_found", status: 404 };
  }

  const { data: steps, error: stepsErr } = await supabase
    .from("hr_workflow_steps")
    .select("id, default_due_days, required")
    .eq("workflow_id", workflow_id)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("step_order", { ascending: true });

  if (stepsErr) {
    console.error("[hrWorkflowEngine] steps lookup error:", stepsErr);
    return { ok: false, error: stepsErr.message, status: 500 };
  }
  const stepList = steps ?? [];

  const today = new Date().toISOString().slice(0, 10);
  let assigned = 0;
  let skipped = 0;
  let created_instances = 0;

  for (const employee_id of employee_ids) {
    const { data: existing } = await supabase
      .from("hr_employee_workflows")
      .select("id")
      .eq("org_id", org_id)
      .eq("employee_id", employee_id)
      .eq("workflow_id", workflow_id)
      .eq("status", "active")
      .maybeSingle();

    if (existing?.id) {
      skipped += 1;
      continue;
    }

    const { data: inst, error: instErr } = await supabase
      .from("hr_employee_workflows")
      .insert({
        org_id,
        site_id,
        employee_id,
        workflow_id,
        status: "active",
      })
      .select("id")
      .single();

    if (instErr) {
      console.error("[hrWorkflowEngine] insert hr_employee_workflows error:", instErr);
      continue;
    }
    created_instances += 1;
    assigned += 1;

    for (const step of stepList) {
      const dueOffset = step.default_due_days ?? 0;
      const dueDate = dueOffset === 0 ? today : (() => {
        const d = new Date(today);
        d.setDate(d.getDate() + dueOffset);
        return d.toISOString().slice(0, 10);
      })();

      await supabase.from("hr_employee_steps").insert({
        org_id,
        site_id,
        employee_id,
        workflow_id,
        step_id: step.id,
        status: "pending",
        due_date: dueDate,
      });
    }
  }

  return {
    ok: true,
    assigned,
    skipped,
    created_instances,
  };
}

/**
 * Evaluate triggers and auto-create employee workflows (call from employee created, role updated, etc.).
 */
export type TriggerContext = {
  org_id: string;
  site_id: string | null;
  employee_id: string;
  trigger: "on_employee_created" | "on_role_assigned" | "on_contract_end" | "on_expiry";
  role_code?: string | null;
};

export async function evaluateTriggers(
  supabase: SupabaseClient,
  ctx: TriggerContext
): Promise<{ created: number }> {
  const { data: workflows } = await supabase
    .from("hr_workflows")
    .select("id")
    .eq("org_id", ctx.org_id)
    .eq("is_active", true)
    .eq("trigger_type", ctx.trigger);

  const list = workflows ?? [];
  const toAssign: string[] = [];
  for (const w of list) {
    if (ctx.role_code != null) {
      const { data: wf } = await supabase
        .from("hr_workflows")
        .select("role_scope")
        .eq("id", w.id)
        .single();
      const scope = (wf as { role_scope?: string | null } | null)?.role_scope?.trim();
      if (scope != null && scope !== "" && scope.toUpperCase() !== ctx.role_code.toUpperCase()) {
        continue;
      }
    }
    toAssign.push(w.id);
  }

  let created = 0;
  for (const workflow_id of toAssign) {
    const result = await runHrWorkflowAssign(supabase, {
      org_id: ctx.org_id,
      site_id: ctx.site_id,
      workflow_id,
      employee_ids: [ctx.employee_id],
    });
    if (result.ok && result.created_instances > 0) created += result.created_instances;
  }
  return { created };
}
