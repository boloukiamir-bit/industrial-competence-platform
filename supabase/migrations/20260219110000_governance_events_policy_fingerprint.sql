-- Phase A: policy fingerprint for governance_events (deterministic tie to policy bundle).
-- No RLS changes.

ALTER TABLE public.governance_events
  ADD COLUMN IF NOT EXISTS policy_fingerprint text NULL;

COMMENT ON COLUMN public.governance_events.policy_fingerprint IS 'SHA256 hex of canonical { legitimacy_status, reason_codes (sorted), policy } for audit reproducibility.';

CREATE INDEX IF NOT EXISTS idx_governance_events_org_policy_fingerprint
  ON public.governance_events (org_id, policy_fingerprint);
