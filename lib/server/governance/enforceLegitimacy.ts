/**
 * BCLEDGE Phase A: deterministic legitimacy gate on writes.
 * Calls getCockpitReadiness; blocks when LEGAL_STOP or NO_GO; always writes audit row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCockpitReadiness } from "@/lib/server/getCockpitReadiness";

export type EnforceArgs = {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  siteId: string | null;
  context: {
    action: string;
    target_type: string;
    target_id?: string;
    meta?: Record<string, unknown>;
  };
  shiftId?: string;
  date?: string;
  shift_code?: string;
};

export type EnforceResult = {
  allowed: boolean;
  status: number;
  error: {
    code: string;
    message: string;
    reason_codes: string[];
    legitimacy_status: string;
    readiness_status: string;
    policy?: Array<{ unit_id: string; industry_type: string; version: number }>;
  };
};

/**
 * Enforce legitimacy for a cockpit write. Does not throw.
 * 1) Runs getCockpitReadiness.
 * 2) Blocks (allowed=false, status=412) when legitimacy_status !== "OK" or readiness_status === "NO_GO".
 * 3) Always inserts one row into governance_events (ALLOWED or BLOCKED).
 */
export async function enforceLegitimacyOrBlock(args: EnforceArgs): Promise<EnforceResult> {
  const { supabase, admin, orgId, siteId, context, shiftId, date, shift_code } = args;

  const readiness = await getCockpitReadiness({
    supabase,
    admin,
    orgId,
    siteId,
    shiftId: shiftId ?? undefined,
    date,
    shift_code,
  });

  const block =
    readiness.legitimacy_status !== "OK" || readiness.readiness_status === "NO_GO";

  const outcome = block ? "BLOCKED" : "ALLOWED";
  const status = block ? 412 : 200;
  const error: EnforceResult["error"] = {
    code: block ? "GOVERNANCE_BLOCKED" : "",
    message: block
      ? "Write blocked by governance: legitimacy or readiness not satisfied."
      : "",
    reason_codes: readiness.reason_codes,
    legitimacy_status: readiness.legitimacy_status,
    readiness_status: readiness.readiness_status,
    policy: readiness.policy?.length ? readiness.policy : undefined,
  };

  let actorUserId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    actorUserId = user?.id ?? null;
  } catch {
    // ignore
  }

  try {
    await admin.from("governance_events").insert({
      org_id: orgId,
      site_id: siteId,
      actor_user_id: actorUserId,
      action: context.action,
      target_type: context.target_type,
      target_id: context.target_id ?? null,
      outcome,
      legitimacy_status: readiness.legitimacy_status,
      readiness_status: readiness.readiness_status,
      reason_codes: readiness.reason_codes,
      meta: context.meta ?? {},
    });
  } catch (e) {
    console.error("[enforceLegitimacy] governance_events insert error:", e);
    // Do not throw; audit failure does not change gate result.
  }

  return {
    allowed: !block,
    status: block ? 412 : 200,
    error,
  };
}

/** Reason codes that always block even in org-only (non-shift) mode. */
const ORG_BLOCK_REASONS = new Set(["NO_SITE", "POLICY_MISSING", "UNIT_MISSING"]);

/**
 * Enforce legitimacy for a non-shift-scoped write (e.g. HR task resolve).
 * Calls getCockpitReadiness without shift; NO_SHIFT is treated as non-blocking (readiness UNKNOWN).
 * Still blocks on NO_SITE / POLICY_MISSING / UNIT_MISSING. Always writes governance_events row.
 */
export async function enforceOrgLegitimacyOrBlock(args: EnforceArgs): Promise<EnforceResult> {
  const { supabase, admin, orgId, siteId, context } = args;

  const readiness = await getCockpitReadiness({
    supabase,
    admin,
    orgId,
    siteId,
    shiftId: undefined,
    date: undefined,
    shift_code: undefined,
  });

  const hasBlockReason = readiness.reason_codes.some((c) => ORG_BLOCK_REASONS.has(c));
  const block = hasBlockReason;

  const outcome = block ? "BLOCKED" : "ALLOWED";
  const readinessStatusForAudit = block
    ? readiness.readiness_status
    : "UNKNOWN";

  const error: EnforceResult["error"] = {
    code: block ? "GOVERNANCE_BLOCKED" : "",
    message: block
      ? "Write blocked by governance: legitimacy or readiness not satisfied."
      : "",
    reason_codes: readiness.reason_codes,
    legitimacy_status: readiness.legitimacy_status,
    readiness_status: block ? readiness.readiness_status : "UNKNOWN",
    policy: readiness.policy?.length ? readiness.policy : undefined,
  };

  let actorUserId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    actorUserId = user?.id ?? null;
  } catch {
    // ignore
  }

  try {
    await admin.from("governance_events").insert({
      org_id: orgId,
      site_id: siteId,
      actor_user_id: actorUserId,
      action: context.action,
      target_type: context.target_type,
      target_id: context.target_id ?? null,
      outcome,
      legitimacy_status: readiness.legitimacy_status,
      readiness_status: readinessStatusForAudit,
      reason_codes: readiness.reason_codes,
      meta: context.meta ?? {},
    });
  } catch (e) {
    console.error("[enforceOrgLegitimacy] governance_events insert error:", e);
  }

  return {
    allowed: !block,
    status: block ? 412 : 200,
    error,
  };
}
