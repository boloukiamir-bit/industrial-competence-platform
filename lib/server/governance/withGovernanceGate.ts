/**
 * Reusable Governance Guard wrapper. No mutating endpoint should bypass legitimacy enforcement.
 * Handles ONLY the gate; does not catch or swallow errors thrown by handler.
 * Shift-scoped routes use enforceLegitimacyOrBlock; org-only (e.g. HR) use enforceOrgLegitimacyOrBlock.
 * When a snapshot was created, returns governance enrichment for binding to decisions.
 * Phase B: execution-critical actions require shift context (shiftId or date+shift_code); otherwise 400 SHIFT_CONTEXT_REQUIRED.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enforceLegitimacyOrBlock,
  enforceOrgLegitimacyOrBlock,
  type GovernanceEnrichment,
} from "@/lib/server/governance/enforceLegitimacy";

export type { GovernanceEnrichment };

/** Actions that must be evaluated in shift scope; missing shift context returns 400 SHIFT_CONTEXT_REQUIRED. */
const EXECUTION_CRITICAL_ACTIONS = new Set<string>([
  "COCKPIT_DECISION_CREATE",
  "TOMORROWS_GAPS_DECISION_CREATE",
  "COMPLIANCE_MUTATION",
  // (later) "SHIFT_ASSIGNMENT_MUTATION", "STATION_REQUIREMENT_MUTATION"
]);

export type GovernanceContext = {
  action: string;
  target_type: string;
  target_id?: string;
  meta?: Record<string, unknown>;
  shiftId?: string;
  date?: string;
  shift_code?: string;
};

export async function withGovernanceGate<T>({
  supabase,
  admin,
  orgId,
  siteId,
  context,
  handler,
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  siteId: string | null;
  context: GovernanceContext;
  handler: (governance?: GovernanceEnrichment) => Promise<T>;
}): Promise<
  | { ok: true; data: T; governance?: GovernanceEnrichment }
  | { ok: false; status: number; error: unknown }
> {
  const hasShiftContext =
    (context.shiftId != null && context.shiftId !== "") ||
    (context.date != null &&
      context.date !== "" &&
      context.shift_code != null &&
      context.shift_code !== "");

  if (EXECUTION_CRITICAL_ACTIONS.has(context.action) && !hasShiftContext) {
    return {
      ok: false,
      status: 400,
      error: {
        kind: "GOVERNANCE",
        code: "SHIFT_CONTEXT_REQUIRED",
        message: "Shift context is required for this action.",
      },
    };
  }

  const gate = hasShiftContext
    ? await enforceLegitimacyOrBlock({
        supabase,
        admin,
        orgId,
        siteId,
        context: {
          action: context.action,
          target_type: context.target_type,
          target_id: context.target_id,
          meta: context.meta,
        },
        shiftId: context.shiftId,
        date: context.date,
        shift_code: context.shift_code,
      })
    : await enforceOrgLegitimacyOrBlock({
        supabase,
        admin,
        orgId,
        siteId,
        context: {
          action: context.action,
          target_type: context.target_type,
          target_id: context.target_id,
          meta: context.meta,
        },
      });

  if (!gate.allowed) {
    return {
      ok: false,
      status: gate.status,
      error: gate.error,
    };
  }

  const data = await handler(gate.governance);
  return gate.governance ? { ok: true, data, governance: gate.governance } : { ok: true, data };
}
