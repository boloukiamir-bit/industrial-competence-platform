/**
 * POST /api/compliance/actions/[id]/done — mark action as done. Admin/HR only.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
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

    try {
      const { data: existing, error: fetchErr } = await ctx.admin
        .from("compliance_actions")
        .select("id, org_id, status")
        .eq("id", id)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
      }
      const ex = existing as { org_id: string; status: string };
      if (ex.org_id !== ctx.orgId) {
        return NextResponse.json(errorPayload("forbidden", "Action not in active org"), { status: 403 });
      }
      if (ex.status === "done") {
        return NextResponse.json({ ok: true, action_id: id });
      }

      const { error: updateErr } = await ctx.admin
        .from("compliance_actions")
        .update({ status: "done", done_at: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", ctx.orgId);

      if (updateErr) {
        console.error("compliance/actions/[id]/done update", updateErr);
        return NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
      }

      return NextResponse.json({ ok: true, action_id: id });
    } catch (err) {
      console.error("POST /api/compliance/actions/[id]/done failed:", err);
      return NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    }
  },
  {
    route: "/api/compliance/actions/[id]/done",
    action: "COMPLIANCE_ACTION_DONE",
    target_type: "compliance_action",
    allowNoShiftContext: true,
  }
);
