/**
 * PATCH /api/compliance/actions/[id] — update status (OPEN|IN_PROGRESS|CLOSED) and/or due_date.
 * Admin/HR only. On status=CLOSED sets closed_at and closed_by; writes governance_events.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin or HR role required"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    const res = NextResponse.json(errorPayload("validation", "id is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const status =
    typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])
      ? (body.status as (typeof ALLOWED_STATUSES)[number])
      : undefined;
  const due_date =
    body.due_date === undefined
      ? undefined
      : body.due_date === null
        ? null
        : typeof body.due_date === "string"
          ? body.due_date.trim() || null
          : undefined;

  if (status === undefined && due_date === undefined) {
    const res = NextResponse.json(
      errorPayload("validation", "At least one of status or due_date is required"),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("compliance_actions")
    .select("id, org_id, site_id, status")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    const res = NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if ((existing as { org_id: string }).org_id !== org.activeOrgId) {
    const res = NextResponse.json(errorPayload("forbidden", "Action not in active org"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (org.activeSiteId != null) {
    const siteId = (existing as { site_id: string | null }).site_id;
    if (siteId != null && siteId !== org.activeSiteId) {
      const res = NextResponse.json(
        errorPayload("forbidden", "Action does not belong to active site"),
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (status !== undefined) updatePayload.status = status;
  if (due_date !== undefined) updatePayload.due_date = due_date;

  if (status === "CLOSED") {
    updatePayload.closed_at = new Date().toISOString();
    updatePayload.closed_by = org.userId;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("compliance_actions")
    .update(updatePayload)
    .eq("id", id)
    .eq("org_id", org.activeOrgId)
    .select("id, status, closed_at, closed_by, due_date")
    .single();

  if (updateErr) {
    console.error("[compliance/actions/[id]] PATCH update", updateErr);
    const res = NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (status === "CLOSED") {
    const row = updated as { id: string; closed_at: string; closed_by: string };
    const idempotencyKey = `COMPLIANCE_ACTION_CLOSE:${id}:${row.closed_at}`;
    await supabaseAdmin.from("governance_events").insert({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId ?? null,
      actor_user_id: org.userId,
      action: "COMPLIANCE_ACTION_CLOSE",
      target_type: "COMPLIANCE_ACTION",
      target_id: id,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_GAP"],
      meta: { closed_by: row.closed_by, closed_at: row.closed_at },
      idempotency_key: idempotencyKey,
    });
    // Log but do not fail response
  }

  const res = NextResponse.json({
    ok: true,
    action: {
      id,
      status: (updated as { status: string }).status,
      due_date: (updated as { due_date: string | null }).due_date ?? null,
      closed_at: (updated as { closed_at: string | null }).closed_at ?? null,
      closed_by: (updated as { closed_by: string | null }).closed_by ?? null,
    },
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
