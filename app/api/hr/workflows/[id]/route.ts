/**
 * PATCH /api/hr/workflows/[id] — update workflow (is_active, name, etc.) or add steps.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const STEP_TYPES = ["task", "document", "compliance_check", "approval"] as const;

export async function PATCH(
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

  const workflowId = (await context.params).id?.trim();
  if (!workflowId) {
    const res = NextResponse.json({ error: "Workflow id is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { is_active?: boolean; name?: string; steps?: Array<{ title: string; step_type?: string; is_required?: boolean; due_offset_days?: number; order_index?: number }> };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();

  if (Object.keys(updates).length > 1) {
    const { error: upErr } = await supabase
      .from("hr_workflows")
      .update(updates)
      .eq("id", workflowId)
      .eq("org_id", org.activeOrgId);
    if (upErr) {
      console.error("[hr/workflows] update error:", upErr);
      const res = NextResponse.json({ error: upErr.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
  }

  if (Array.isArray(body.steps) && body.steps.length > 0) {
    const { data: existingSteps } = await supabase
      .from("hr_workflow_steps")
      .select("id")
      .eq("workflow_id", workflowId);
    const maxOrder = (existingSteps ?? []).length;
    const stepRows = body.steps.map((s, i) => ({
      org_id: org.activeOrgId,
      workflow_id: workflowId,
      step_order: maxOrder + i,
      order_index: s.order_index ?? maxOrder + i,
      code: `step_${maxOrder + i}`,
      name: typeof s.title === "string" ? s.title : `Step ${maxOrder + i + 1}`,
      default_due_days: s.due_offset_days ?? null,
      required: s.is_required !== false,
      step_type: s.step_type && STEP_TYPES.includes(s.step_type as (typeof STEP_TYPES)[number]) ? s.step_type : "task",
    }));
    await supabase.from("hr_workflow_steps").insert(stepRows);
  }

  const res = NextResponse.json({ ok: true, id: workflowId });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
