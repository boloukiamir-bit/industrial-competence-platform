-- Phase A: governance_config for feature flags (e.g. require execution token for decisions).
-- One org-wide row per org (site_id NULL); optional site-specific rows (site_id set).
-- Lookup: prefer site-specific over org-wide.

CREATE TABLE IF NOT EXISTS public.governance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  require_execution_token_for_decisions boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.governance_config IS 'Per-org/site governance flags. Default: token optional for decisions.';
COMMENT ON COLUMN public.governance_config.require_execution_token_for_decisions IS 'When true, POST /api/cockpit/decisions requires a valid execution_token.';

CREATE INDEX IF NOT EXISTS idx_governance_config_org_id
  ON public.governance_config (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_config_org_site
  ON public.governance_config (org_id, site_id)
  WHERE site_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_config_org_null_site
  ON public.governance_config (org_id)
  WHERE site_id IS NULL;

ALTER TABLE public.governance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY governance_config_select_org
  ON public.governance_config
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT/UPDATE: service role only (no policy for authenticated).
