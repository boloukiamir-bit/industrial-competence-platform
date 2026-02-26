/**
 * POST /api/compliance/actions/[id]/evidence — attach evidence URL + notes. Admin/HR only.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

const EVIDENCE_URL_MAX_LEN = 2048;
const EVIDENCE_NOTES_MAX_LEN = 4096;
const URL_PATTERN = /^https?:\/\/.+/;

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

function getActionIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/");
  const i = parts.indexOf("actions");
  if (i < 0 || i + 1 >= parts.length) return null;
  const id = parts[i + 1];
  return id && id !== "create" && id !== "recommend" ? id : null;
}

export const POST = withMutationGovernance(
  async (ctx) => {
    const { data: membership } = await ctx.supabase
      .from("memberships")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("org_id", ctx.orgId)
      .eq("status", "active")
      .maybeSingle();

    if (!isHrAdmin(membership?.role)) {
      return NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    }

    const id = getActionIdFromPath(new URL(ctx.request.url).pathname);
    if (!id) {
      return NextResponse.json(errorPayload("validation", "id is required"), { status: 400 });
    }

    const body = ctx.body as { evidence_url?: string; evidence_notes?: string };
    const rawUrl = typeof body.evidence_url === "string" ? body.evidence_url.trim() : "";
    if (!rawUrl) {
      return NextResponse.json(errorPayload("validation", "evidence_url is required"), { status: 400 });
    }
    if (rawUrl.length > EVIDENCE_URL_MAX_LEN) {
      return NextResponse.json(errorPayload("validation", `evidence_url max length ${EVIDENCE_URL_MAX_LEN}`), { status: 400 });
    }
    if (!URL_PATTERN.test(rawUrl)) {
      return NextResponse.json(errorPayload("validation", "evidence_url must be http or https URL"), { status: 400 });
    }

    const evidenceNotes =
      typeof body.evidence_notes === "string"
        ? body.evidence_notes.trim().slice(0, EVIDENCE_NOTES_MAX_LEN) || null
        : null;

    try {
      const { data: action, error: fetchErr } = await ctx.admin
        .from("compliance_actions")
        .select("id, org_id, site_id")
        .eq("id", id)
        .single();

      if (fetchErr || !action) {
        return NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
      }
      const act = action as { org_id: string; site_id: string | null };
      if (act.org_id !== ctx.orgId) {
        return NextResponse.json(errorPayload("forbidden", "Action not in active org"), { status: 403 });
      }

      if (ctx.siteId != null && act.site_id !== ctx.siteId) {
        return NextResponse.json(
          { ok: false, step: "site_mismatch", error: "Action is not in the active site" },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await ctx.admin
        .from("compliance_actions")
        .update({
          evidence_url: rawUrl,
          evidence_notes: evidenceNotes,
          evidence_added_at: now,
          evidence_added_by: ctx.userId,
        })
        .eq("id", id)
        .eq("org_id", ctx.orgId);

      if (updateErr) {
        console.error("compliance/actions/[id]/evidence update", updateErr);
        return NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
      }

      const { error: insertErr } = await ctx.admin.from("compliance_action_events").insert({
        org_id: act.org_id,
        site_id: act.site_id,
        action_id: id,
        event_type: "evidence_added",
        channel: null,
        template_id: null,
        copied_title: false,
        copied_body: false,
        created_by: ctx.userId,
      });

      if (insertErr) {
        console.error("compliance/actions/[id]/evidence event insert", insertErr);
        return NextResponse.json(errorPayload("insert_event", insertErr.message), { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("POST /api/compliance/actions/[id]/evidence failed:", err);
      return NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    }
  },
  {
    route: "/api/compliance/actions/[id]/evidence",
    action: "COMPLIANCE_ACTION_EVIDENCE",
    target_type: "compliance_action",
    allowNoShiftContext: true,
  }
);
