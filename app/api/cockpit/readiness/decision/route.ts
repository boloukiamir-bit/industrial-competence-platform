/**
 * GET /api/cockpit/readiness/decision?shift_id=<uuid>
 * POST /api/cockpit/readiness/decision
 * Shift readiness governance: log or fetch one decision per org+site+shift (execution_decisions).
 * Tenant-scoped via session org_id + site_id only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { shiftReadinessTargetId } from "@/lib/shared/decisionIds";
import { pool } from "@/lib/db/pool";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECISIONS = ["ACKNOWLEDGED", "OVERRIDE", "STOP"] as const;
const MAX_NOTE_LENGTH = 500;

function isUuid(v: string | null): v is string {
  return typeof v === "string" && v.length === 36 && UUID_RE.test(v);
}

export type ReadinessDecisionPayload = {
  decision: "ACKNOWLEDGED" | "OVERRIDE" | "STOP";
  note: string;
  created_at: string;
  created_by: string | null;
};

export type ReadinessDecisionGetResponse = { ok: true; decision: ReadinessDecisionPayload | null };
export type ReadinessDecisionPostResponse = { ok: true; decision: ReadinessDecisionPayload };

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const orgResult = await getActiveOrgFromSession(request, supabase);
  if (!orgResult.ok) {
    const res = NextResponse.json({ error: orgResult.error }, { status: orgResult.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const shiftId = request.nextUrl.searchParams.get("shift_id")?.trim() ?? null;
  if (!shiftId || !isUuid(shiftId)) {
    const res = NextResponse.json(
      { error: "shift_id is required and must be a valid UUID" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const activeSiteId = orgResult.activeSiteId ?? null;
  const targetId = shiftReadinessTargetId(orgResult.activeOrgId, activeSiteId, shiftId);

  const { rows } = await pool.query(
    `SELECT reason, actions, created_at, created_by
     FROM execution_decisions
     WHERE org_id = $1 AND decision_type = $2 AND target_type = $3 AND target_id = $4 AND status = 'active'
     LIMIT 1`,
    [orgResult.activeOrgId, "shift_readiness", "shift_readiness", targetId]
  );

  const row = rows[0];
  if (!row) {
    const res = NextResponse.json({ ok: true, decision: null } satisfies ReadinessDecisionGetResponse);
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const actions = row.actions as { decision?: string } | null;
  const decision = DECISIONS.includes((actions?.decision as (typeof DECISIONS)[number]) ?? ("" as never))
    ? (actions!.decision as (typeof DECISIONS)[number])
    : "ACKNOWLEDGED";

  const res = NextResponse.json({
    ok: true,
    decision: {
      decision,
      note: row.reason ?? "",
      created_at: row.created_at ? new Date(row.created_at).toISOString() : "",
      created_by: row.created_by ?? null,
    },
  } satisfies ReadinessDecisionGetResponse);
  applySupabaseCookies(res, pendingCookies);
  return res;
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const orgResult = await getActiveOrgFromSession(request, supabase);
  if (!orgResult.ok) {
    const res = NextResponse.json({ error: orgResult.error }, { status: orgResult.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { shift_id?: string; decision?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const shiftId = typeof body.shift_id === "string" ? body.shift_id.trim() : null;
  if (!shiftId || !isUuid(shiftId)) {
    const res = NextResponse.json(
      { error: "shift_id is required and must be a valid UUID" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const decision = body.decision;
  if (!decision || !DECISIONS.includes(decision as (typeof DECISIONS)[number])) {
    const res = NextResponse.json(
      { error: "decision must be one of: ACKNOWLEDGED, OVERRIDE, STOP" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const note = typeof body.note === "string" ? body.note.slice(0, MAX_NOTE_LENGTH) : "";
  if (body.note != null && body.note.length > MAX_NOTE_LENGTH) {
    const res = NextResponse.json(
      { error: `note must be at most ${MAX_NOTE_LENGTH} characters` },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const reason = note ?? "";

  const activeSiteId = orgResult.activeSiteId ?? null;
  const targetId = shiftReadinessTargetId(orgResult.activeOrgId, activeSiteId, shiftId);
  const rootCause = JSON.stringify({
    type: "shift_readiness",
    shift_id: shiftId,
  });
  const actionsJson = JSON.stringify({ decision: decision as (typeof DECISIONS)[number] });

  const upsertQuery = `
    INSERT INTO execution_decisions (
      org_id, site_id, decision_type, target_type, target_id,
      reason, root_cause, actions, status, created_by, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())
    ON CONFLICT (decision_type, target_type, target_id) WHERE (status = 'active')
    DO UPDATE SET
      reason = EXCLUDED.reason,
      root_cause = EXCLUDED.root_cause,
      actions = EXCLUDED.actions,
      created_by = EXCLUDED.created_by,
      created_at = NOW()
    RETURNING reason, actions, created_at, created_by
  `;

  const result = await pool.query(upsertQuery, [
    orgResult.activeOrgId,
    activeSiteId,
    "shift_readiness",
    "shift_readiness",
    targetId,
    reason,
    rootCause,
    actionsJson,
    "active",
    orgResult.userId,
  ]);

  const row = result.rows[0];
  const actions = row?.actions as { decision?: string } | null;
  const outDecision = DECISIONS.includes((actions?.decision as (typeof DECISIONS)[number]) ?? ("" as never))
    ? (actions!.decision as (typeof DECISIONS)[number])
    : "ACKNOWLEDGED";

  const res = NextResponse.json({
    ok: true,
    decision: {
      decision: outDecision,
      note: row?.reason ?? "",
      created_at: row?.created_at ? new Date(row.created_at).toISOString() : "",
      created_by: row?.created_by ?? null,
    },
  } satisfies ReadinessDecisionPostResponse);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
