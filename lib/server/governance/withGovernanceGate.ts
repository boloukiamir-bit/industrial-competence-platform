/**
 * Reusable Governance Guard wrapper. No mutating endpoint should bypass legitimacy enforcement.
 * Handles ONLY the gate; does not catch or swallow errors thrown by handler.
 * Shift-scoped routes use enforceLegitimacyOrBlock; org-only (e.g. HR) use enforceOrgLegitimacyOrBlock.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enforceLegitimacyOrBlock,
  enforceOrgLegitimacyOrBlock,
} from "@/lib/server/governance/enforceLegitimacy";

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
  handler: () => Promise<T>;
}): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; error: unknown }
> {
  const hasShiftContext =
    context.shiftId != null ||
    (context.date != null && context.date !== "") ||
    (context.shift_code != null && context.shift_code !== "");

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

  const data = await handler();
  return { ok: true, data };
}
