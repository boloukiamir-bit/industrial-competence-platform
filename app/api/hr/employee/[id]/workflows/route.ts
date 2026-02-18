/**
 * GET /api/hr/employee/[id]/workflows — list employee's workflow instances with step progress.
 * Returns active + completed; progress %, overdue count, blocked count.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employeeId = (await context.params).id?.trim();
  if (!employeeId) {
    const res = NextResponse.json({ error: "Employee id is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: instances, error: instErr } = await supabase
    .from("hr_employee_workflows")
    .select("id, workflow_id, status, started_at, completed_at")
    .eq("org_id", org.activeOrgId)
    .eq("employee_id", employeeId)
    .in("status", ["active", "completed"])
    .order("started_at", { ascending: false });

  if (instErr) {
    console.error("[hr/employee/workflows] instances error:", instErr);
    const res = NextResponse.json({ error: instErr.message }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const list = (instances ?? []) as Array<{
    id: string;
    workflow_id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
  }>;
  const workflowIds = [...new Set(list.map((i) => i.workflow_id))];

  const { data: workflowNames } = await supabase
    .from("hr_workflows")
    .select("id, name")
    .in("id", workflowIds);
  const nameByWf = new Map(
    (workflowNames ?? []).map((w: { id: string; name: string }) => [w.id, w.name])
  );

  const { data: stepRows } = await supabase
    .from("hr_employee_steps")
    .select("id, workflow_id, step_id, status, due_date, completed_at")
    .eq("org_id", org.activeOrgId)
    .eq("employee_id", employeeId)
    .in("workflow_id", workflowIds);

  const stepsByWorkflow = new Map<string, Array<{ id: string; status: string; due_date: string | null; completed_at: string | null }>>();
  for (const s of stepRows ?? []) {
    const row = s as { workflow_id: string; id: string; status: string; due_date: string | null; completed_at: string | null };
    if (!stepsByWorkflow.has(row.workflow_id)) {
      stepsByWorkflow.set(row.workflow_id, []);
    }
    stepsByWorkflow.get(row.workflow_id)!.push({
      id: row.id,
      status: row.status,
      due_date: row.due_date,
      completed_at: row.completed_at,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const out = list.map((inst) => {
    const steps = stepsByWorkflow.get(inst.workflow_id) ?? [];
    const total = steps.length;
    const completed = steps.filter((s) => s.status === "completed" || s.status === "waived").length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdue = steps.filter((s) => s.status !== "completed" && s.status !== "waived" && s.due_date != null && s.due_date < today).length;
    const blocked = steps.filter((s) => s.status === "blocked").length;

    return {
      id: inst.id,
      workflow_id: inst.workflow_id,
      workflow_name: nameByWf.get(inst.workflow_id) ?? null,
      status: inst.status,
      started_at: inst.started_at,
      completed_at: inst.completed_at,
      progress_percent: progress,
      steps_total: total,
      steps_completed: completed,
      overdue_count: overdue,
      blocked_count: blocked,
    };
  });

  const res = NextResponse.json(out);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
