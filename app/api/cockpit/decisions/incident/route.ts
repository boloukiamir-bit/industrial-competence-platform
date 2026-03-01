/**
 * POST /api/cockpit/decisions/incident — log an incident decision (SHIFT mode).
 * Auth: getActiveOrgFromSession.
 * target_type: COCKPIT_INCIDENT. Idempotency by root_cause.idempotency_key (no fake UUID).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { buildIdempotencyKey, type IssuePayload } from "@/lib/server/cockpitIncidentIdempotency";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Allowed decision action (stored in root_cause.decision.action). */
const DECISION_ACTIONS = ["ACKNOWLEDGE", "OVERRIDE", "ESCALATE"] as const;
/** DB decision_type column: system-level type for incident decisions. */
const DB_DECISION_TYPE_MAP: Record<string, string> = {
  ACKNOWLEDGE: "ACKNOWLEDGED",
  OVERRIDE: "OVERRIDDEN",
  ESCALATE: "escalate",
};
const SHIFT_CODES = ["Day", "Evening", "Night"] as const;

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
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

  const decisionActionRaw = typeof body.decision_type === "string" ? body.decision_type.trim().toUpperCase() : "";
  const decisionAction = DECISION_ACTIONS.includes(decisionActionRaw as (typeof DECISION_ACTIONS)[number])
    ? decisionActionRaw
    : null;
  if (!decisionAction) {
    const res = NextResponse.json(
      { ok: false, error: "decision_type must be one of ACKNOWLEDGE, OVERRIDE, ESCALATE" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    const res = NextResponse.json(
      { ok: false, error: "reason is required and must be non-empty" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const dateRaw = typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const res = NextResponse.json(
      { ok: false, error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const shiftCodeRaw = typeof body.shift_code === "string" ? body.shift_code.trim() : "";
  const shiftCode = SHIFT_CODES.includes(shiftCodeRaw as (typeof SHIFT_CODES)[number])
    ? shiftCodeRaw
    : normalizeShiftParam(shiftCodeRaw) || null;
  if (!shiftCode) {
    const res = NextResponse.json(
      { ok: false, error: "shift_code must be Day, Evening, or Night" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const issue = body.issue && typeof body.issue === "object" ? (body.issue as IssuePayload) : null;
  if (!issue) {
    const res = NextResponse.json(
      { ok: false, error: "issue object is required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const idempotencyKey = buildIdempotencyKey(dateRaw, shiftCode, issue);
  const dbDecisionType = DB_DECISION_TYPE_MAP[decisionAction] ?? "ACKNOWLEDGED";

  const root_cause = {
    type: "cockpit_incident" as const,
    kind: "cockpit_incident" as const,
    idempotency_key: idempotencyKey,
    issue,
    decision: { action: decisionAction, reason },
    shift: { date: dateRaw, shift_code: shiftCode, line: "all" as const },
  };

  try {
    const { data: existing } = await supabaseAdmin
      .from("execution_decisions")
      .select("id, target_id")
      .eq("org_id", org.activeOrgId)
      .eq("target_type", "COCKPIT_INCIDENT")
      .contains("root_cause", { idempotency_key: idempotencyKey })
      .maybeSingle();

    if (existing) {
      const res = NextResponse.json({
        ok: true,
        decision_id: existing.id,
        idempotency_key: idempotencyKey,
        target_type: "COCKPIT_INCIDENT",
        target_id: existing.target_id,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const target_id = randomUUID();
    const row = {
      org_id: org.activeOrgId,
      site_id: org.activeSiteId ?? null,
      decision_type: dbDecisionType,
      target_type: "COCKPIT_INCIDENT" as const,
      target_id,
      reason,
      root_cause,
      status: "active",
      created_by: org.userId,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("execution_decisions")
      .insert(row as Record<string, unknown>)
      .select("id, target_id")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        const { data: afterConflict } = await supabaseAdmin
          .from("execution_decisions")
          .select("id, target_id")
          .eq("org_id", org.activeOrgId)
          .eq("target_type", "COCKPIT_INCIDENT")
          .contains("root_cause", { idempotency_key: idempotencyKey })
          .maybeSingle();
        const res = NextResponse.json({
          ok: true,
          decision_id: afterConflict?.id ?? null,
          idempotency_key: idempotencyKey,
          target_type: "COCKPIT_INCIDENT",
          target_id: afterConflict?.target_id ?? target_id,
        });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[cockpit/decisions/incident] insert error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to save decision" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      ok: true,
      decision_id: inserted?.id,
      idempotency_key: idempotencyKey,
      target_type: "COCKPIT_INCIDENT",
      target_id: inserted?.target_id ?? target_id,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/decisions/incident] error:", err);
    const res = NextResponse.json(
      { ok: false, error: "Failed to save decision" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
