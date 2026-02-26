/**
 * POST /api/compliance/actions/[id]/draft-event — log a draft_copied audit event.
 * Body: { channel?, template_id?, copied_title:boolean, copied_body:boolean }
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

const CHANNELS = ["email", "sms", "note"] as const;

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
    const actionId = getActionIdFromPath(new URL(ctx.request.url).pathname);
    if (!actionId) {
      return NextResponse.json(errorPayload("validation", "id is required"), { status: 400 });
    }

    const body = ctx.body as Record<string, unknown>;
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
      const { data: action, error: fetchErr } = await ctx.admin
        .from("compliance_actions")
        .select("id, org_id, site_id")
        .eq("id", actionId)
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

      const { error: insertErr } = await ctx.admin.from("compliance_action_events").insert({
        org_id: act.org_id,
        site_id: act.site_id,
        action_id: actionId,
        event_type: "draft_copied",
        channel,
        template_id: templateId || null,
        copied_title: copiedTitle,
        copied_body: copiedBody,
        created_by: ctx.userId,
      });

      if (insertErr) {
        console.error("compliance/actions/[id]/draft-event insert", insertErr);
        return NextResponse.json(errorPayload("insert", insertErr.message), { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("POST /api/compliance/actions/[id]/draft-event failed:", err);
      return NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    }
  },
  {
    route: "/api/compliance/actions/[id]/draft-event",
    action: "COMPLIANCE_ACTION_DRAFT_EVENT",
    target_type: "compliance_action",
    allowNoShiftContext: true,
  }
);
