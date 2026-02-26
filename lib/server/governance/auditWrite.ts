/**
 * Helper to write governance_events for editability audit.
 * Use after successful PATCH/mutations: action, target_type, target_id, reason_codes,
 * and optional before/after diff + request_id (stored in meta).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditWriteParams = {
  /** Supabase client with service role (bypasses RLS for insert). */
  admin: SupabaseClient;
  /** Org context */
  orgId: string;
  siteId?: string | null;
  /** Actor (current user) */
  actorUserId: string;
  /** Action code (e.g. EMPLOYEE_UPDATE, COMPLIANCE_ACTION_UPDATE) */
  action: string;
  /** Target entity type (e.g. EMPLOYEE, COMPLIANCE_ACTION) */
  targetType: string;
  /** Target entity id */
  targetId: string;
  /** Reason codes (required for sensitive changes). */
  reasonCodes: string[];
  /** Additional meta (before/after and request_id are merged in when provided). */
  meta?: Record<string, unknown>;
  /** State before change (included in meta.before). */
  before?: Record<string, unknown> | null;
  /** State after change (included in meta.after). */
  after?: Record<string, unknown> | null;
  /** Request id (e.g. from X-Request-Id); included in meta.request_id. */
  requestId?: string | null;
  /** Idempotency key for dedupe. If omitted, a default is generated from action+target_id+timestamp. */
  idempotencyKey?: string | null;
};

const DEFAULT_OUTCOME = "RECORDED";
const DEFAULT_LEGITIMACY = "OK";
const DEFAULT_READINESS = "NON_BLOCKING";

/**
 * Writes one row to governance_events. Merges before, after, request_id into meta.
 * Does not throw; logs and returns error so caller can decide whether to fail the request.
 */
export async function auditWrite(params: AuditWriteParams): Promise<{ error: Error | null }> {
  const {
    admin,
    orgId,
    siteId = null,
    actorUserId,
    action,
    targetType,
    targetId,
    reasonCodes,
    meta = {},
    before,
    after,
    requestId,
    idempotencyKey,
  } = params;

  const metaMerged: Record<string, unknown> = { ...meta };
  if (before != null) metaMerged.before = before;
  if (after != null) metaMerged.after = after;
  if (requestId != null && requestId !== "") metaMerged.request_id = requestId;

  const key =
    idempotencyKey ?? `AUDIT:${action}:${targetType}:${targetId}:${Date.now()}`;

  const { error } = await admin.from("governance_events").insert({
    org_id: orgId,
    site_id: siteId ?? null,
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    outcome: DEFAULT_OUTCOME,
    legitimacy_status: DEFAULT_LEGITIMACY,
    readiness_status: DEFAULT_READINESS,
    reason_codes: Array.isArray(reasonCodes) ? reasonCodes : [],
    meta: metaMerged,
    idempotency_key: key,
  });

  if (error) {
    console.error("[auditWrite] governance_events insert failed", {
      action,
      target_type: targetType,
      target_id: targetId,
      error: error.message,
    });
    return { error };
  }
  return { error: null };
}
