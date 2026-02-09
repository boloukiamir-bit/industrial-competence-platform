import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { normalizeShift } from "@/lib/shift";
import { stationShiftTargetId } from "@/lib/shared/decisionIds";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ACTIONS = ["acknowledged", "plan_training", "swap", "escalate"] as const;

export async function POST(request: NextRequest) {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const res = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const res = NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const b = body as Record<string, unknown>;
    const dateRaw = typeof b.date === "string" ? b.date.trim() : "";
    const shiftRaw = typeof b.shift_code === "string" ? b.shift_code.trim() : "";
    const stationId = typeof b.station_id === "string" ? b.station_id.trim() : "";
    const issueTypeRaw = typeof b.issue_type === "string" ? b.issue_type.trim() : "";
    const actionRaw = typeof b.action === "string" ? b.action.trim().toLowerCase() : "";
    const actionsObj = b.actions && typeof b.actions === "object" ? (b.actions as Record<string, unknown>) : {};
    const chosen = (actionsObj.chosen ?? actionRaw) as string;
    const action = ALLOWED_ACTIONS.includes(chosen as (typeof ALLOWED_ACTIONS)[number]) ? chosen : null;
    const note = typeof b.note === "string" ? b.note.trim() || null : null;
    const resolved = b.resolved === true;

    const shift = normalizeShift(shiftRaw || "Day");
    const dateMatch = dateRaw.match(/^\d{4}-\d{2}-\d{2}$/);
    const dateStr = dateMatch ? dateRaw : "";
    const issueType = ["NO_GO", "WARNING", "GO"].includes(issueTypeRaw) ? issueTypeRaw : "NO_GO";

    if (!stationId) {
      const res = NextResponse.json(
        { ok: false, error: "station_id is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!dateStr) {
      const res = NextResponse.json(
        { ok: false, error: "date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!shift) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift_code", details: { shift_code: shiftRaw } },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!action) {
      const res = NextResponse.json(
        { ok: false, error: `action must be one of: ${ALLOWED_ACTIONS.join(", ")}` },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const targetId = stationShiftTargetId(
      org.activeOrgId,
      org.activeSiteId,
      dateStr,
      shift,
      stationId,
      issueType
    );

    const rootCause = {
      type: "station_issue",
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      station_id: stationId,
      shift_date: dateStr,
      shift_code: shift,
      issue_type: issueType,
      selected_action: action,
      notes: note ?? undefined,
    };

    const actions = {
      chosen: action,
      note: note ?? undefined,
      resolved: resolved || true,
    };

    const { data: existing } = await supabaseAdmin
      .from("execution_decisions")
      .select("id, status, created_at, created_by")
      .eq("org_id", org.activeOrgId)
      .eq("decision_type", "acknowledged_station_issue")
      .eq("target_type", "station_shift")
      .eq("target_id", targetId)
      .maybeSingle();

    let record: Record<string, unknown>;
    if (existing && existing.status === "active") {
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("execution_decisions")
        .update({
          root_cause: rootCause,
          actions,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updErr) {
        console.error("[cockpit/issues/decision] update error:", updErr);
        const res = NextResponse.json(
          { ok: false, error: "Failed to update decision" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      record = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("execution_decisions")
        .insert({
          org_id: org.activeOrgId,
          site_id: org.activeSiteId,
          decision_type: "acknowledged_station_issue",
          target_type: "station_shift",
          target_id: targetId,
          root_cause: rootCause,
          actions,
          status: "active",
          created_by: user.id,
        })
        .select()
        .single();

      if (insErr) {
        console.error("[cockpit/issues/decision] insert error:", insErr);
        const res = NextResponse.json(
          { ok: false, error: "Failed to save decision" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      record = inserted as Record<string, unknown>;
    }

    const res = NextResponse.json({
      ok: true,
      decision: record,
      target_id: targetId,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/decision] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to save decision" },
      { status: 500 }
    );
  }
}
