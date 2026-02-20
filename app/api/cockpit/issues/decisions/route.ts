import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import {
  createSupabaseServerClient,
  applySupabaseCookies,
} from "@/lib/supabase/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { stationShiftTargetId } from "@/lib/shared/decisionIds";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ACTIONS = ["acknowledged", "plan_training", "swap", "escalate"] as const;

export const POST = withMutationGovernance(
  async (ctx) => {
    const stationId = typeof ctx.body.station_id === "string" ? ctx.body.station_id.trim() : "";
    const issueTypeRaw = typeof ctx.body.issue_type === "string" ? ctx.body.issue_type.trim() : "";
    const actionRaw = typeof ctx.body.action === "string" ? ctx.body.action.trim().toLowerCase() : "";
    const actionsObj =
      ctx.body.actions && typeof ctx.body.actions === "object"
        ? (ctx.body.actions as Record<string, unknown>)
        : {};
    const chosen = (actionsObj.chosen ?? actionRaw) as string;
    const action = ALLOWED_ACTIONS.includes(chosen as (typeof ALLOWED_ACTIONS)[number])
      ? chosen
      : null;
    const note = typeof ctx.body.note === "string" ? ctx.body.note.trim() || null : null;

    const dateStr = ctx.date ?? "";
    const shift = ctx.shift_code ?? "";
    const issueType = ["NO_GO", "WARNING", "GO"].includes(issueTypeRaw) ? issueTypeRaw : "NO_GO";

    if (!stationId) {
      return NextResponse.json(
        { ok: false, error: "station_id is required" },
        { status: 400 }
      );
    }
    if (!action) {
      return NextResponse.json(
        { ok: false, error: `action must be one of: ${ALLOWED_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const targetId = stationShiftTargetId(
      ctx.orgId,
      ctx.siteId,
      dateStr,
      shift,
      stationId,
      issueType
    );

    const rootCause = {
      type: "station_issue",
      org_id: ctx.orgId,
      site_id: ctx.siteId,
      station_id: stationId,
      shift_date: dateStr,
      shift_code: shift,
      issue_type: issueType,
      selected_action: action,
      notes: note ?? undefined,
    };

    const actions = { chosen: action, note: note ?? undefined, resolved: true };

    const { data: existing } = await ctx.admin
      .from("execution_decisions")
      .select("id, status")
      .eq("org_id", ctx.orgId)
      .eq("decision_type", "acknowledged_station_issue")
      .eq("target_type", "station_shift")
      .eq("target_id", targetId)
      .maybeSingle();

    let record: Record<string, unknown>;
    if (existing && existing.status === "active") {
      const { data: updated, error: updErr } = await ctx.admin
        .from("execution_decisions")
        .update({ root_cause: rootCause, actions })
        .eq("id", existing.id)
        .select()
        .single();
      if (updErr) {
        console.error("[cockpit/issues/decisions] update error:", updErr);
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
          site_id: ctx.siteId,
          decision_type: "acknowledged_station_issue",
          target_type: "station_shift",
          target_id: targetId,
          root_cause: rootCause,
          actions,
          status: "active",
          created_by: ctx.userId,
        })
        .select()
        .single();
      if (insErr) {
        console.error("[cockpit/issues/decisions] insert error:", insErr);
        return NextResponse.json(
          { ok: false, error: "Failed to save decision" },
          { status: 500 }
        );
      }
      record = inserted as Record<string, unknown>;
    }

    return NextResponse.json({
      ok: true,
      decision: record,
      target_id: targetId,
      decision_id: (record as { id?: string }).id,
    });
  },
  {
    route: "/api/cockpit/issues/decisions",
    action: "COCKPIT_ISSUE_DECISION_CREATE",
    target_type: "station_shift",
    getTargetIdAndMeta: (body, shift) => {
      const stationId = typeof body.station_id === "string" ? body.station_id.trim() : "";
      const issueType = typeof body.issue_type === "string" ? body.issue_type.trim() : "NO_GO";
      const date = shift.date ?? (typeof body.date === "string" ? body.date.trim().slice(0, 10) : "");
      const shiftCode = shift.shift_code ?? "";
      const target_id =
        date && shiftCode && stationId
          ? `station_shift:${stationId}:${date}:${shiftCode}:${issueType}`
          : "unknown";
      return {
        target_id,
        meta: {
          station_id: stationId,
          issue_type: issueType,
        },
      };
    },
  }
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const shiftCode =
      searchParams.get("shift_code") || searchParams.get("shift")?.trim() || undefined;

    if (!shiftCode) {
      const res = NextResponse.json(
        { ok: false, error: "shift_code is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = supabaseAdmin
      .from("execution_decisions")
      .select("root_cause")
      .eq("org_id", org.activeOrgId)
      .in("decision_type", ["station_issue", "acknowledged_station_issue"])
      .eq("target_type", "station_shift")
      .eq("status", "active");

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/issues/decisions] query error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch decisions" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const stationIds = new Set<string>();
    for (const row of rows || []) {
      const rc = row.root_cause as Record<string, unknown> | null;
      if (rc && typeof rc.station_id === "string" && rc.shift_code === shiftCode) {
        stationIds.add(rc.station_id);
      }
    }

    const res = NextResponse.json({
      ok: true,
      station_ids: Array.from(stationIds),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/decisions] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load decisions" },
      { status: 500 }
    );
  }
}
