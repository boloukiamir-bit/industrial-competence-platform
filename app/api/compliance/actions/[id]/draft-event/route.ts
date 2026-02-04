/**
 * POST /api/compliance/actions/[id]/draft-event — log a draft_copied audit event.
 * Body: { channel?, template_id?, copied_title:boolean, copied_body:boolean }
 * Any org member may insert. Site: if activeSiteId set, action.site_id must match else 409.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHANNELS = ["email", "sms", "note"] as const;

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

  const { id: actionId } = await params;
  if (!actionId) {
    const res = NextResponse.json(errorPayload("validation", "id is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const copiedTitle = body.copied_title === true;
  const copiedBody = body.copied_body !== false;
  const channel =
    typeof body.channel === "string" && CHANNELS.includes(body.channel as (typeof CHANNELS)[number])
      ? (body.channel as (typeof CHANNELS)[number])
      : null;
  const templateId =
    body.template_id != null && body.template_id !== ""
      ? (typeof body.template_id === "string" ? body.template_id : String(body.template_id))
      : null;

  try {
    const { data: action, error: fetchErr } = await supabaseAdmin
      .from("compliance_actions")
      .select("id, org_id, site_id")
      .eq("id", actionId)
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

    const { error: insertErr } = await supabaseAdmin.from("compliance_action_events").insert({
      org_id: action.org_id,
      site_id: action.site_id,
      action_id: actionId,
      event_type: "draft_copied",
      channel,
      template_id: templateId || null,
      copied_title: copiedTitle,
      copied_body: copiedBody,
      created_by: org.userId,
    });

    if (insertErr) {
      console.error("compliance/actions/[id]/draft-event insert", insertErr);
      const res = NextResponse.json(errorPayload("insert", insertErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/actions/[id]/draft-event failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
