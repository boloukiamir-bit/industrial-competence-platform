/**
 * POST /api/compliance/actions/[id]/evidence — attach evidence URL + notes. Admin/HR only.
 * Site: if activeSiteId set, action.site_id must match else 409.
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

const EVIDENCE_URL_MAX_LEN = 2048;
const EVIDENCE_NOTES_MAX_LEN = 4096;
const URL_PATTERN = /^https?:\/\/.+/;

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
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

  let body: { evidence_url?: string; evidence_notes?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const rawUrl = typeof body.evidence_url === "string" ? body.evidence_url.trim() : "";
  if (!rawUrl) {
    const res = NextResponse.json(errorPayload("validation", "evidence_url is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (rawUrl.length > EVIDENCE_URL_MAX_LEN) {
    const res = NextResponse.json(errorPayload("validation", `evidence_url max length ${EVIDENCE_URL_MAX_LEN}`), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!URL_PATTERN.test(rawUrl)) {
    const res = NextResponse.json(errorPayload("validation", "evidence_url must be http or https URL"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const evidenceNotes =
    typeof body.evidence_notes === "string"
      ? body.evidence_notes.trim().slice(0, EVIDENCE_NOTES_MAX_LEN) || null
      : null;

  try {
    const { data: action, error: fetchErr } = await supabaseAdmin
      .from("compliance_actions")
      .select("id, org_id, site_id")
      .eq("id", id)
      .single();

    if (fetchErr || !action) {
      const res = NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (action.org_id !== org.activeOrgId) {
      const res = NextResponse.json(errorPayload("forbidden", "Action not in active org"), { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (org.activeSiteId != null && action.site_id !== org.activeSiteId) {
      const res = NextResponse.json(
        { ok: false, step: "site_mismatch", error: "Action is not in the active site" },
        { status: 409 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from("compliance_actions")
      .update({
        evidence_url: rawUrl,
        evidence_notes: evidenceNotes,
        evidence_added_at: now,
        evidence_added_by: org.userId,
      })
      .eq("id", id)
      .eq("org_id", org.activeOrgId);

    if (updateErr) {
      console.error("compliance/actions/[id]/evidence update", updateErr);
      const res = NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { error: insertErr } = await supabaseAdmin.from("compliance_action_events").insert({
      org_id: action.org_id,
      site_id: action.site_id,
      action_id: id,
      event_type: "evidence_added",
      channel: null,
      template_id: null,
      copied_title: false,
      copied_body: false,
      created_by: org.userId,
    });

    if (insertErr) {
      console.error("compliance/actions/[id]/evidence event insert", insertErr);
      const res = NextResponse.json(errorPayload("insert_event", insertErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/actions/[id]/evidence failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
