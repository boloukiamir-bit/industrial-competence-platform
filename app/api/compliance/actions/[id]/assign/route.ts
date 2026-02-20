/**
 * POST /api/compliance/actions/[id]/assign
 * Body: { owner_user_id?: string|null } — if omitted, assign to current user.
 * Admin/HR only. Org-scoped. Governed via withMutationGovernance.
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

function getIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/");
  const i = parts.indexOf("actions");
  if (i < 0 || i + 1 >= parts.length) return null;
  const id = parts[i + 1];
  return id && id !== "create" ? id : null;
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

    const pathname = new URL(ctx.request.url).pathname;
    const id = getIdFromPath(pathname);
    if (!id) {
      return NextResponse.json(errorPayload("validation", "id is required"), { status: 400 });
    }

    const owner_user_id =
      ctx.body.owner_user_id === undefined
        ? ctx.userId
        : ctx.body.owner_user_id === null
          ? null
          : typeof ctx.body.owner_user_id === "string"
            ? ctx.body.owner_user_id.trim() || null
            : ctx.userId;

    const { data: existing, error: fetchErr } = await ctx.admin
      .from("compliance_actions")
      .select("id, org_id, site_id")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
    }
    if ((existing as { org_id: string }).org_id !== ctx.orgId) {
      return NextResponse.json(
        errorPayload("forbidden", "Action not in active org"),
        { status: 403 }
      );
    }
    if (
      ctx.siteId != null &&
      (existing as { site_id: string | null }).site_id !== ctx.siteId
    ) {
      return NextResponse.json(
        errorPayload("forbidden", "Action does not belong to active site"),
        { status: 403 }
      );
    }

    let updateQuery = ctx.admin
      .from("compliance_actions")
      .update({ owner_user_id })
      .eq("id", id)
      .eq("org_id", ctx.orgId);
    if (ctx.siteId) {
      updateQuery = updateQuery.eq("site_id", ctx.siteId);
    }

    const { error: updateErr } = await updateQuery;

    if (updateErr) {
      console.error("compliance/actions/[id]/assign", updateErr);
      return NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
    }

    return NextResponse.json({ ok: true, action_id: id });
  },
  {
    route: "/api/compliance/actions/[id]/assign",
    action: "COMPLIANCE_ACTION_ASSIGN",
    target_type: "compliance_action",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (_body, _shift) => {
      return { target_id: "assign", meta: {} };
    },
  }
);
