/**
 * BCLEDGE Phase A: deterministic legitimacy gate on writes.
 * Calls getCockpitReadiness; blocks when LEGAL_STOP or NO_GO; always writes audit row.
 * policy_fingerprint ties each event to the policy bundle used (deterministic SHA256).
 * governance_snapshots stores an immutable snapshot per evaluation; events link via snapshot_id.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCockpitReadiness } from "@/lib/server/getCockpitReadiness";
import {
  toPolicyEnvelope,
  type PolicyEnvelope,
} from "@/lib/server/policyEnvelope";

type ReadinessForSnapshot = {
  legitimacy_status: string;
  readiness_status: string;
  reason_codes: string[];
  policy_fingerprint: string;
  calculated_at?: string | null;
  policy?: PolicyEnvelope | null;
  blocking_stations?: string[] | null;
  readiness_score?: number | null;
};

/** Persist snapshot; returns { snapshotId } or { snapshotError }. Does not throw. */
async function persistSnapshot(
  admin: SupabaseClient,
  params: {
    orgId: string;
    siteId: string | null;
    scope: "org" | "shift";
    shiftId?: string | null;
    shiftDate?: string | null;
    shiftCode?: string | null;
    readiness: ReadinessForSnapshot;
  }
): Promise<{ snapshotId: string } | { snapshotError: string }> {
  const { orgId, siteId, scope, shiftId, shiftDate, shiftCode, readiness } = params;
  const payload = {
    legitimacy_status: readiness.legitimacy_status,
    readiness_status: readiness.readiness_status,
    reason_codes: readiness.reason_codes,
    policy_fingerprint: readiness.policy_fingerprint,
    policy: readiness.policy ?? null,
    blocking_stations: readiness.blocking_stations ?? null,
    readiness_score: readiness.readiness_score ?? null,
  };
  const row = {
    org_id: orgId,
    site_id: siteId,
    scope,
    shift_id: shiftId ?? null,
    shift_date: shiftDate ?? null,
    shift_code: shiftCode ?? null,
    legitimacy_status: readiness.legitimacy_status,
    readiness_status: readiness.readiness_status,
    reason_codes: readiness.reason_codes,
    policy_fingerprint: readiness.policy_fingerprint,
    calculated_at: readiness.calculated_at ?? null,
    payload,
  };
  try {
    const { data, error } = await admin
      .from("governance_snapshots")
      .insert(row as Record<string, unknown>)
      .select("id")
      .single();
    if (error) return { snapshotError: error.message };
    const id = data?.id;
    if (typeof id !== "string") return { snapshotError: "No id returned from snapshot insert" };
    return { snapshotId: id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { snapshotError: msg };
  }
}

/** Deterministic JSON stringify (sorted keys). Handles primitives, arrays, objects. Circular refs fallback to String(obj). */
function stableStringify(obj: unknown, seen = new WeakSet<object>()): string {
  if (obj === null) return "null";
  if (obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (seen.has(obj as object)) return JSON.stringify(String(obj));
  if (Array.isArray(obj)) {
    seen.add(obj as object);
    const parts = obj.map((v) => stableStringify(v, seen));
    seen.delete(obj as object);
    return "[" + parts.join(",") + "]";
  }
  seen.add(obj as object);
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k], seen));
  seen.delete(obj as object);
  return "{" + parts.join(",") + "}";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Canonicalize envelope for stable fingerprint: units by unit_id, stations by station_id, reason_codes sorted per station. */
function canonicalizePolicyEnvelope(envelope: PolicyEnvelope): PolicyEnvelope {
  const units = [...envelope.units].sort((a, b) => a.unit_id.localeCompare(b.unit_id));
  const stations = [...envelope.compliance.stations].sort((a, b) =>
    String(a.station_id).localeCompare(String(b.station_id))
  );
  const compliance = {
    stations: stations.map((s) => ({
      ...s,
      reason_codes: [...(s.reason_codes ?? [])].sort((a, b) => a.localeCompare(b)),
    })),
    totals: envelope.compliance.totals,
  };
  return { units, compliance };
}

/** Exported for execution token binding (readiness route). Uses canonical envelope for stable hashes. */
export function computePolicyFingerprint(
  legitimacy_status: string,
  reason_codes: string[],
  policyEnvelope: PolicyEnvelope
): string {
  const sortedReasons = [...reason_codes].sort((a, b) => a.localeCompare(b));
  const canonical = {
    legitimacy_status,
    reason_codes: sortedReasons,
    policy: canonicalizePolicyEnvelope(policyEnvelope),
  };
  return sha256Hex(stableStringify(canonical));
}

function computeIdempotencyKey(params: {
  orgId: string;
  action: string;
  target_id: string;
  outcome: string;
  policy_fingerprint: string;
  scope: "org" | "shift";
  shift_date: string;
  shift_code: string;
}): string {
  const canonical = {
    action: params.action,
    orgId: params.orgId,
    outcome: params.outcome,
    policy_fingerprint: params.policy_fingerprint,
    scope: params.scope,
    shift_code: params.shift_code,
    shift_date: params.shift_date,
    target_id: params.target_id,
  };
  return sha256Hex(stableStringify(canonical));
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("duplicate key") && msg.includes("unique constraint");
}

/**
 * Event-first atomic insert. snapshot_id is always null.
 * Returns { inserted: true, eventId } on success; { inserted: false } on duplicate; { inserted: false, error } on other error.
 */
async function tryInsertEventSkeleton(
  admin: SupabaseClient,
  params: {
    org_id: string;
    site_id: string | null;
    actor_user_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    outcome: string;
    legitimacy_status: string;
    readiness_status: string;
    reason_codes: string[];
    policy_fingerprint: string;
    idempotency_key: string;
    meta: Record<string, unknown>;
  }
): Promise<{ inserted: true; eventId: string } | { inserted: false; error?: string }> {
  try {
    const { data, error } = await admin
      .from("governance_events")
      .insert({
        org_id: params.org_id,
        site_id: params.site_id,
        actor_user_id: params.actor_user_id,
        action: params.action,
        target_type: params.target_type,
        target_id: params.target_id,
        outcome: params.outcome,
        legitimacy_status: params.legitimacy_status,
        readiness_status: params.readiness_status,
        reason_codes: params.reason_codes,
        policy_fingerprint: params.policy_fingerprint,
        idempotency_key: params.idempotency_key,
        meta: params.meta,
        snapshot_id: null,
      } as Record<string, unknown>)
      .select("id")
      .single();
    if (error) {
      if (isUniqueViolation(error)) return { inserted: false };
      return { inserted: false, error: error.message };
    }
    const eventId = data?.id;
    if (typeof eventId !== "string") return { inserted: false, error: "No id returned" };
    return { inserted: true, eventId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("duplicate key") && msg.toLowerCase().includes("unique")) {
      return { inserted: false };
    }
    return { inserted: false, error: msg };
  }
}

/** Patch snapshot_id on the event row we just inserted (race-safe: only where snapshot_id is null). */
async function patchEventSnapshotId(
  admin: SupabaseClient,
  orgId: string,
  idempotencyKey: string,
  snapshotId: string
): Promise<void> {
  try {
    await admin
      .from("governance_events")
      .update({ snapshot_id: snapshotId } as Record<string, unknown>)
      .eq("org_id", orgId)
      .eq("idempotency_key", idempotencyKey)
      .is("snapshot_id", null);
  } catch (e) {
    console.error("[enforceLegitimacy] patchEventSnapshotId error:", e);
  }
}

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

export type GovernanceEnrichment = {
  snapshot_id: string;
  policy_fingerprint: string;
  readiness_status: string;
  readiness_score: number | null;
  calculated_at: string | null;
};

export type EnforceResult = {
  allowed: boolean;
  status: number;
  error: {
    kind?: "GOVERNANCE";
    code: string;
    message: string;
    reason_codes: string[];
    legitimacy_status: string;
    readiness_status: string;
    policy?: PolicyEnvelope;
  };
  governance?: GovernanceEnrichment;
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

  const policyEnvelope = toPolicyEnvelope(readiness.policy, readiness.policy_compliance);

  const outcome = block ? "BLOCKED" : "ALLOWED";
  const status = block ? 412 : 200;
  const error: EnforceResult["error"] = {
    ...(block && { kind: "GOVERNANCE" as const }),
    code: block ? "GOVERNANCE_BLOCKED" : "",
    message: block
      ? "Write blocked by governance: legitimacy or readiness not satisfied."
      : "",
    reason_codes: readiness.reason_codes,
    legitimacy_status: readiness.legitimacy_status,
    readiness_status: readiness.readiness_status,
    policy: policyEnvelope,
  };

  const policy_fingerprint = computePolicyFingerprint(
    readiness.legitimacy_status,
    readiness.reason_codes,
    policyEnvelope
  );

  const scope: "org" | "shift" =
    shiftId != null || date != null || (shift_code != null && shift_code !== "")
      ? "shift"
      : "org";

  const idempotency_key = computeIdempotencyKey({
    orgId,
    action: context.action,
    target_id: context.target_id ?? "",
    outcome,
    policy_fingerprint,
    scope,
    shift_date: date ?? "",
    shift_code: shift_code ?? "",
  });

  let actorUserId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    actorUserId = user?.id ?? null;
  } catch {
    // ignore
  }

  const meta: Record<string, unknown> = { ...(context.meta ?? {}) };
  if (readiness.unknown_reason_codes?.length) {
    meta.unknown_reason_codes = readiness.unknown_reason_codes;
    meta.unknown_reason_codes_count = readiness.unknown_reason_codes.length;
  }
  const insertResult = await tryInsertEventSkeleton(admin, {
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
    policy_fingerprint,
    idempotency_key,
    meta,
  });

  if (!insertResult.inserted) {
    return { allowed: !block, status: block ? 412 : 200, error };
  }

  const snapshotResult = await persistSnapshot(admin, {
    orgId,
    siteId,
    scope,
    shiftId: shiftId ?? null,
    shiftDate: date ?? null,
    shiftCode: shift_code ?? null,
    readiness: {
      legitimacy_status: readiness.legitimacy_status,
      readiness_status: readiness.readiness_status,
      reason_codes: readiness.reason_codes,
      policy_fingerprint,
      calculated_at: readiness.calculated_at ?? null,
      policy: policyEnvelope,
      blocking_stations: readiness.blocking_stations ?? null,
      readiness_score: readiness.readiness_score ?? null,
    },
  });

  let governance: GovernanceEnrichment | undefined;
  if ("snapshotId" in snapshotResult) {
    await patchEventSnapshotId(admin, orgId, idempotency_key, snapshotResult.snapshotId);
    governance = {
      snapshot_id: snapshotResult.snapshotId,
      policy_fingerprint,
      readiness_status: readiness.readiness_status,
      readiness_score: readiness.readiness_score ?? null,
      calculated_at: readiness.calculated_at ?? null,
    };
  }

  return {
    allowed: !block,
    status: block ? 412 : 200,
    error,
    governance,
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

  const policyEnvelope = toPolicyEnvelope(readiness.policy, readiness.policy_compliance);

  const error: EnforceResult["error"] = {
    ...(block && { kind: "GOVERNANCE" as const }),
    code: block ? "GOVERNANCE_BLOCKED" : "",
    message: block
      ? "Write blocked by governance: legitimacy or readiness not satisfied."
      : "",
    reason_codes: readiness.reason_codes,
    legitimacy_status: readiness.legitimacy_status,
    readiness_status: block ? readiness.readiness_status : "UNKNOWN",
    policy: policyEnvelope,
  };

  const policy_fingerprint = computePolicyFingerprint(
    readiness.legitimacy_status,
    readiness.reason_codes,
    policyEnvelope
  );

  const idempotency_key = computeIdempotencyKey({
    orgId,
    action: context.action,
    target_id: context.target_id ?? "",
    outcome,
    policy_fingerprint,
    scope: "org",
    shift_date: "",
    shift_code: "",
  });

  let actorUserId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    actorUserId = user?.id ?? null;
  } catch {
    // ignore
  }

  const meta: Record<string, unknown> = { ...(context.meta ?? {}) };
  if (readiness.unknown_reason_codes?.length) {
    meta.unknown_reason_codes = readiness.unknown_reason_codes;
    meta.unknown_reason_codes_count = readiness.unknown_reason_codes.length;
  }
  const insertResult = await tryInsertEventSkeleton(admin, {
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
    policy_fingerprint,
    idempotency_key,
    meta,
  });

  if (!insertResult.inserted) {
    return { allowed: !block, status: block ? 412 : 200, error };
  }

  const snapshotResult = await persistSnapshot(admin, {
    orgId,
    siteId,
    scope: "org",
    shiftId: null,
    shiftDate: null,
    shiftCode: null,
    readiness: {
      legitimacy_status: readiness.legitimacy_status,
      readiness_status: readinessStatusForAudit,
      reason_codes: readiness.reason_codes,
      policy_fingerprint,
      calculated_at: readiness.calculated_at ?? null,
      policy: policyEnvelope,
      blocking_stations: readiness.blocking_stations ?? null,
      readiness_score: readiness.readiness_score ?? null,
    },
  });

  let governance: GovernanceEnrichment | undefined;
  if ("snapshotId" in snapshotResult) {
    await patchEventSnapshotId(admin, orgId, idempotency_key, snapshotResult.snapshotId);
    governance = {
      snapshot_id: snapshotResult.snapshotId,
      policy_fingerprint,
      readiness_status: readinessStatusForAudit,
      readiness_score: readiness.readiness_score ?? null,
      calculated_at: readiness.calculated_at ?? null,
    };
  }

  return {
    allowed: !block,
    status: block ? 412 : 200,
    error,
    governance,
  };
}
