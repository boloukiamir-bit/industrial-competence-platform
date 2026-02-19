/**
 * Phase A Governance Firewall: enforce admin presence and governed mutation before any write.
 * Not the legitimacy check — prevents unsafe mutations from running at all.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type FirewallResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Require that a mutating route has admin client and is governed.
 * Call at top of handler before any write.
 */
export function requireGovernedMutation(opts: {
  admin: SupabaseClient | null;
  governed: boolean;
  context: { route: string; action: string };
}): FirewallResult {
  const { admin, governed, context } = opts;

  if (admin === null) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error: {
          code: "GOVERNANCE_NOT_CONFIGURED",
          message: "Service role admin client is missing.",
        },
      },
    };
  }

  if (governed === false) {
    return {
      ok: false,
      status: 501,
      body: {
        ok: false,
        error: {
          code: "GOVERNANCE_NOT_WIRED",
          message:
            "This mutation is disabled in Phase A until governance gate is applied.",
          route: context.route,
          action: context.action,
        },
      },
    };
  }

  return { ok: true };
}
