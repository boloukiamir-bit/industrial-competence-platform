/**
 * PATCH /api/hr/employee-step/[id] — update step status (pending | completed | waived | blocked).
 * Body: { status, completed_by?: uuid }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const VALID_STATUSES = ["pending", "completed", "waived", "blocked"] as const;

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

  const stepId = (await context.params).id?.trim();
  if (!stepId) {
    const res = NextResponse.json({ error: "Step id is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { status?: string; completed_by?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const status = typeof body.status === "string" && VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
    ? body.status
    : null;
  if (!status) {
    const res = NextResponse.json(
      { error: "status is required and must be one of: " + VALID_STATUSES.join(", ") },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "completed" || status === "waived") {
    update.completed_at = new Date().toISOString();
    if (typeof body.completed_by === "string" && body.completed_by.trim()) {
      update.completed_by = body.completed_by.trim();
    } else if (org.userId) {
      update.completed_by = org.userId;
    }
  }

  const { data: row, error } = await supabase
    .from("hr_employee_steps")
    .update(update)
    .eq("id", stepId)
    .eq("org_id", org.activeOrgId)
    .select("id, status, completed_at, completed_by")
    .single();

  if (error) {
    console.error("[hr/employee-step] update error:", error);
    const res = NextResponse.json({ error: error.message }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!row) {
    const res = NextResponse.json({ error: "Step not found" }, { status: 404 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({ ok: true, id: row.id, status: row.status, completed_at: row.completed_at, completed_by: row.completed_by });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
