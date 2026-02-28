/**
 * POST /api/cockpit/issues/decision — create or update execution decision for a station shift.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 * When execution-bound (shift context + RESOLVED/OVERRIDDEN/ACKNOWLEDGED/DEFERRED), creates or reuses
 * a readiness snapshot and links it via readiness_snapshot_id.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { normalizeShift } from "@/lib/shift";
import { stationShiftTargetId } from "@/lib/shared/decisionIds";
import { createOrReuseReadinessSnapshot } from "@/lib/server/readiness/freezeReadinessSnapshot";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ACTIONS = ["acknowledged", "plan_training", "swap", "escalate"] as const;
const DECISION_TYPES = ["ACKNOWLEDGED", "OVERRIDDEN", "DEFERRED", "RESOLVED"] as const;
/** Decision types that trigger execution-bound freeze (snapshot created and linked). */
const EXECUTION_BOUND_DECISION_TYPES = ["RESOLVED", "OVERRIDDEN", "ACKNOWLEDGED", "DEFERRED"] as const;
const ISSUE_TYPES = ["NO_GO", "WARNING", "GO", "UNSTAFFED", "ILLEGAL"] as const;

function normalizeIssueType(raw: string): string {
  const u = raw.toUpperCase().trim();
  return ISSUE_TYPES.includes(u as (typeof ISSUE_TYPES)[number]) ? u : "NO_GO";
}

export const POST = withMutationGovernance(
  async (ctx) => {
    const b = ctx.body as Record<string, unknown>;
    const dateRaw = typeof b.date === "string" ? b.date.trim() : "";
    const shiftRaw = typeof b.shift_code === "string" ? b.shift_code.trim() : "";
    const stationId = typeof b.station_id === "string" ? b.station_id.trim() : "";
    const issueTypeRaw = typeof b.issue_type === "string" ? b.issue_type.trim() : "";
    const note = typeof b.note === "string" ? b.note.trim() || null : null;
    const decisionTypeRaw = typeof b.decision_type === "string" ? b.decision_type.trim().toUpperCase() : "";
    const resolvedFromBody = typeof b.resolved === "boolean" ? b.resolved : b.resolved === true;
    const linkedJobIdRaw = typeof b.linked_job_id === "string" ? b.linked_job_id.trim() || null : null;

    const shift = normalizeShift(shiftRaw || "Day");
    const dateMatch = dateRaw.match(/^\d{4}-\d{2}-\d{2}$/);
    const dateStr = dateMatch ? dateRaw : "";
    const issueType = normalizeIssueType(issueTypeRaw || "NO_GO");

    if (!stationId) {
      return NextResponse.json(
        { ok: false, error: "station_id is required" },
        { status: 400 }
      );
    }
    if (!dateStr) {
      return NextResponse.json(
        { ok: false, error: "date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (!shift) {
      return NextResponse.json(
        { ok: false, error: "Invalid shift_code", details: { shift_code: shiftRaw } },
        { status: 400 }
      );
    }

    const targetId = stationShiftTargetId(
      ctx.orgId,
      ctx.siteId ?? null,
      dateStr,
      shift,
      stationId,
      issueType
    );

    let decisionType: string;
    let resolved: boolean;
    let linkedJobId: string | null = null;
    if (DECISION_TYPES.includes(decisionTypeRaw as (typeof DECISION_TYPES)[number])) {
      decisionType = decisionTypeRaw;
      resolved = decisionType === "RESOLVED" || resolvedFromBody;
      if (linkedJobIdRaw && /^[0-9a-f-]{36}$/i.test(linkedJobIdRaw)) linkedJobId = linkedJobIdRaw;
    } else {
      const actionRaw = typeof b.action === "string" ? b.action.trim().toLowerCase() : "";
      const actionsObj = b.actions && typeof b.actions === "object" ? (b.actions as Record<string, unknown>) : {};
      const chosen = (actionsObj.chosen ?? actionRaw) as string;
      const action = ALLOWED_ACTIONS.includes(chosen as (typeof ALLOWED_ACTIONS)[number]) ? chosen : null;
      if (!action) {
        return NextResponse.json(
          { ok: false, error: `decision_type must be one of ${DECISION_TYPES.join(", ")} or action one of: ${ALLOWED_ACTIONS.join(", ")}` },
          { status: 400 }
        );
      }
      decisionType = "acknowledged_station_issue";
      resolved = (["acknowledged", "resolved", "plan_training", "swap", "escalate"] as const).includes(action as "acknowledged") || resolvedFromBody;
    }

    const rootCause: Record<string, unknown> = {
      type: "station_issue",
      org_id: ctx.orgId,
      site_id: ctx.siteId ?? undefined,
      station_id: stationId,
      shift_date: dateStr,
      shift_code: shift,
      issue_type: issueType,
      notes: note ?? undefined,
    };
    if (decisionType === "acknowledged_station_issue" && typeof b.action === "string") {
      const a = (b.action as string).trim().toLowerCase();
      const actionsObj = b.actions && typeof b.actions === "object" ? (b.actions as Record<string, unknown>) : {};
      const chosen = (actionsObj.chosen ?? a) as string;
      rootCause.selected_action = chosen;
    }

    const actions: Record<string, unknown> = {
      note: note ?? undefined,
      resolved,
    };
    if (decisionType === "acknowledged_station_issue") {
      const actionRaw = typeof b.action === "string" ? b.action.trim().toLowerCase() : "";
      const actionsObj = b.actions && typeof b.actions === "object" ? (b.actions as Record<string, unknown>) : {};
      const chosen = (actionsObj.chosen ?? actionRaw) as string;
      actions.chosen = chosen;
      actions.selected_action = chosen;
    }

    const isExecutionBound =
      dateStr &&
      shift &&
      (EXECUTION_BOUND_DECISION_TYPES as readonly string[]).includes(decisionType);
    let snapshotResult: { snapshot_id: string; created_at: string; duplicate: boolean } | null = null;
    if (isExecutionBound) {
      let siteIdForSnapshot = ctx.siteId ?? null;
      if (!siteIdForSnapshot) {
        const { data: firstSite } = await ctx.admin
          .from("sites")
          .select("id")
          .eq("org_id", ctx.orgId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstSite?.id) siteIdForSnapshot = firstSite.id;
      }
      if (siteIdForSnapshot && normalizeShiftParam(shift)) {
        try {
          snapshotResult = await createOrReuseReadinessSnapshot({
            admin: ctx.admin,
            orgId: ctx.orgId,
            siteId: siteIdForSnapshot,
            userId: ctx.userId,
            date: dateStr,
            shiftCode: shift,
            baseUrl: ctx.request.nextUrl.origin,
            cookieHeader: ctx.request.headers.get("cookie") ?? "",
          });
        } catch (snapErr) {
          console.error("[cockpit/issues/decision] readiness snapshot error:", snapErr);
        }
      }
    }

    const { data: existing } = await ctx.admin
      .from("execution_decisions")
      .select("id, status, created_at, created_by, readiness_snapshot_id")
      .eq("org_id", ctx.orgId)
      .eq("target_type", "station_shift")
      .eq("target_id", targetId)
      .eq("status", "active")
      .maybeSingle();

    const payload: Record<string, unknown> = {
      root_cause: rootCause,
      actions,
      decision_type: decisionType,
      ...(linkedJobId && { linked_job_id: linkedJobId }),
    };
    if (snapshotResult) {
      const existingSnapshotId = (existing as { readiness_snapshot_id?: string | null } | undefined)?.readiness_snapshot_id;
      payload.readiness_snapshot_id = existingSnapshotId ?? snapshotResult.snapshot_id;
    }

    let record: Record<string, unknown>;
    if (existing) {
      const { data: updated, error: updErr } = await ctx.admin
        .from("execution_decisions")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (updErr) {
        console.error("[cockpit/issues/decision] update error:", updErr);
        return NextResponse.json(
          { ok: false, error: "Failed to update decision" },
          { status: 500 }
        );
      }
      record = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error: insErr } = await ctx.admin
        .from("execution_decisions")
        .insert({
          org_id: ctx.orgId,
          site_id: ctx.siteId ?? undefined,
          target_type: "station_shift",
          target_id: targetId,
          ...payload,
          status: "active",
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (insErr) {
        console.error("[cockpit/issues/decision] insert error:", insErr);
        return NextResponse.json(
          { ok: false, error: "Failed to save decision" },
          { status: 500 }
        );
      }
      record = inserted as Record<string, unknown>;
    }

    const wantDebug = b.debug === true || ctx.request.nextUrl.searchParams.get("debug") === "1";
    return NextResponse.json({
      ok: true,
      decision: record,
      target_id: targetId,
      ...(record.readiness_snapshot_id != null && { readiness_snapshot_id: record.readiness_snapshot_id }),
      ...(wantDebug &&
        snapshotResult != null && {
          _debug: {
            snapshot_created: !snapshotResult.duplicate,
            snapshot_duplicate: snapshotResult.duplicate,
          },
        }),
    });
  },
  {
    route: "/api/cockpit/issues/decision",
    action: "COCKPIT_DECISION_CREATE",
    target_type: "station_shift",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => {
      const stationId = typeof body.station_id === "string" ? body.station_id.trim() : "";
      const dateStr = typeof body.date === "string" ? body.date.trim() : "";
      const shiftRaw = typeof body.shift_code === "string" ? body.shift_code.trim() : "";
      return {
        target_id: stationId && dateStr && shiftRaw ? `${stationId}:${dateStr}:${shiftRaw}` : "unknown",
        meta: { station_id: stationId || undefined, date: dateStr || undefined, shift_code: shiftRaw || undefined },
      };
    },
  }
);
