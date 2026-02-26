/**
 * POST /api/compliance/actions/[id]/update — update action metadata.
 * Body: { due_date?: string|null, notes?: string|null, owner_user_id?: string|null }
 * Admin/HR only. Governed via withMutationGovernance (allowNoShiftContext: true).
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

    const body = ctx.body;
    const due_date =
      body.due_date === undefined
        ? undefined
        : body.due_date === null
          ? null
          : typeof body.due_date === "string"
            ? body.due_date.trim() || null
            : undefined;
    const notes =
      body.notes === undefined
        ? undefined
        : body.notes === null
          ? null
          : typeof body.notes === "string"
            ? body.notes.trim() || null
            : undefined;
    const owner_user_id =
      body.owner_user_id === undefined
        ? undefined
        : body.owner_user_id === null
          ? null
          : typeof body.owner_user_id === "string"
            ? body.owner_user_id.trim() || null
            : undefined;

    if (due_date === undefined && notes === undefined && owner_user_id === undefined) {
      return NextResponse.json(
        errorPayload("validation", "At least one of due_date, notes, owner_user_id required"),
        { status: 400 }
      );
    }

    try {
      const { data: existing, error: fetchErr } = await ctx.admin
        .from("compliance_actions")
        .select("id, org_id, site_id")
        .eq("id", id)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
      }
      const ex = existing as { org_id: string; site_id: string | null };
      if (ex.org_id !== ctx.orgId) {
        return NextResponse.json(errorPayload("forbidden", "Action not in active org"), { status: 403 });
      }
      if (ctx.siteId != null && ex.site_id !== ctx.siteId) {
        return NextResponse.json(
          errorPayload("forbidden", "Action does not belong to active site; cross-site edits not allowed"),
          { status: 403 }
        );
      }

      const updatePayload: Record<string, unknown> = {};
      if (due_date !== undefined) updatePayload.due_date = due_date;
      if (notes !== undefined) updatePayload.notes = notes;
      if (owner_user_id !== undefined) updatePayload.owner_user_id = owner_user_id;

      let updateQuery = ctx.admin
        .from("compliance_actions")
        .update(updatePayload)
        .eq("id", id)
        .eq("org_id", ctx.orgId);
      if (ctx.siteId) {
        updateQuery = updateQuery.eq("site_id", ctx.siteId);
      }

      const { error: updateErr } = await updateQuery;

      if (updateErr) {
        console.error("compliance/actions/[id]/update", updateErr);
        return NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
      }

      return NextResponse.json({ ok: true, action_id: id });
    } catch (err) {
      console.error("POST /api/compliance/actions/[id]/update failed:", err);
      return NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    }
  },
  {
    route: "/api/compliance/actions/[id]/update",
    action: "COMPLIANCE_ACTION_UPDATE",
    target_type: "compliance_action",
    allowNoShiftContext: true,
  }
);
