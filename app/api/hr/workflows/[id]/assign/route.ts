/**
 * POST /api/hr/workflows/[id]/assign — assign workflow to one or more employees.
 * Creates hr_employee_workflows + hr_employee_steps. Idempotent: skips if active instance exists.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { runHrWorkflowAssign } from "@/lib/server/hrWorkflowEngine";

export async function POST(
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

  let body: { employee_id?: string; employee_ids?: string[] };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const single = typeof body.employee_id === "string" ? body.employee_id.trim() : null;
  const multiple = Array.isArray(body.employee_ids)
    ? body.employee_ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)
    : [];
  const employeeIds = single ? [single] : multiple;
  if (employeeIds.length === 0) {
    const res = NextResponse.json(
      { error: "Provide employee_id or employee_ids" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const result = await runHrWorkflowAssign(supabase, {
    org_id: org.activeOrgId,
    site_id: org.activeSiteId ?? null,
    workflow_id: workflowId,
    employee_ids: employeeIds,
  });

  if (!result.ok) {
    const res = NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    assigned: result.assigned,
    skipped: result.skipped,
    created_instances: result.created_instances,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
