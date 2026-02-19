/**
 * Phase A – Governance config (e.g. require execution token for decisions).
 * Prefer site-specific row over org-wide (site_id null).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type GovernanceConfig = {
  require_execution_token_for_decisions: boolean;
  require_one_time_execution_token_for_decisions: boolean;
};

const DEFAULT: GovernanceConfig = {
  require_execution_token_for_decisions: false,
  require_one_time_execution_token_for_decisions: false,
};

/**
 * Load governance config for org/site. Site-specific row wins over org-wide.
 * No row => default (token optional).
 */
export async function getGovernanceConfig(
  supabase: SupabaseClient,
  orgId: string,
  siteId: string | null
): Promise<GovernanceConfig> {
  const query = supabase
    .from("governance_config")
    .select("site_id, require_execution_token_for_decisions, require_one_time_execution_token_for_decisions")
    .eq("org_id", orgId);
  const { data: rows, error } =
    siteId != null && siteId !== ""
      ? await query.or(`site_id.is.null,site_id.eq.${siteId}`)
      : await query.is("site_id", null);

  if (error || !rows?.length) {
    return DEFAULT;
  }

  const siteSpecific = rows.find(
    (r: { site_id: string | null }) => r.site_id != null && r.site_id === siteId
  );
  const orgWide = rows.find((r: { site_id: string | null }) => r.site_id == null);
  const row = siteSpecific ?? orgWide ?? rows[0];
  return {
    require_execution_token_for_decisions:
      row?.require_execution_token_for_decisions === true,
    require_one_time_execution_token_for_decisions:
      row?.require_one_time_execution_token_for_decisions === true,
  };
}
