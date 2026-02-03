/**
 * POST /api/compliance/actions/[id]/assign
 * Body: { owner_user_id?: string|null } — if omitted, assign to current user.
 * Admin/HR only. Org-scoped. Strict site check when activeSiteId set.
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

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function POST(
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
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
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
    body = {};
  }

  const owner_user_id =
    body.owner_user_id === undefined
      ? org.userId
      : body.owner_user_id === null
        ? null
        : typeof body.owner_user_id === "string"
          ? body.owner_user_id.trim() || null
          : org.userId;

  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("compliance_actions")
      .select("id, org_id, site_id")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      const res = NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (existing.org_id !== org.activeOrgId) {
      const res = NextResponse.json(errorPayload("forbidden", "Action not in active org"), { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (org.activeSiteId != null && existing.site_id !== org.activeSiteId) {
      const res = NextResponse.json(
        errorPayload("forbidden", "Action does not belong to active site"),
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let updateQuery = supabaseAdmin
      .from("compliance_actions")
      .update({ owner_user_id })
      .eq("id", id)
      .eq("org_id", org.activeOrgId);
    if (org.activeSiteId) {
      updateQuery = updateQuery.eq("site_id", org.activeSiteId);
    }

    const { error: updateErr } = await updateQuery;

    if (updateErr) {
      console.error("compliance/actions/[id]/assign", updateErr);
      const res = NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, action_id: id });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/actions/[id]/assign failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
