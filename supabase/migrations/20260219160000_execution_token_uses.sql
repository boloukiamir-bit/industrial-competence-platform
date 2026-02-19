-- Phase A: one-time execution token uses (anti-replay). Feature-flagged via governance_config.

CREATE TABLE IF NOT EXISTS public.execution_token_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NULL,
  jti text NOT NULL,
  token_hash text NOT NULL,
  action text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.execution_token_uses IS 'One-time use of execution tokens per (org_id, jti). Replay returns 409.';
COMMENT ON COLUMN public.execution_token_uses.jti IS 'JWT ID / unique token identifier from execution token payload.';
COMMENT ON COLUMN public.execution_token_uses.token_hash IS 'SHA256 hex of token string (for audit).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_token_uses_org_jti
  ON public.execution_token_uses (org_id, jti);

CREATE INDEX IF NOT EXISTS idx_execution_token_uses_org_used_at
  ON public.execution_token_uses (org_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_token_uses_org_action_used_at
  ON public.execution_token_uses (org_id, action, used_at DESC);

ALTER TABLE public.execution_token_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY execution_token_uses_select_org
  ON public.execution_token_uses
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT: service role only (no policy for authenticated).

-- Add anti-replay flag to governance_config
ALTER TABLE public.governance_config
  ADD COLUMN IF NOT EXISTS require_one_time_execution_token_for_decisions boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.governance_config.require_one_time_execution_token_for_decisions IS 'When true, execution_token can only be used once for decisions (replay -> 409).';
