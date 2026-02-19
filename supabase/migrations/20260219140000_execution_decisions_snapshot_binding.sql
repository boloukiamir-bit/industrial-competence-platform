-- Phase A: bind execution_decisions to governance snapshot that allowed the mutation.
-- Additive only; no NOT NULL.

ALTER TABLE public.execution_decisions
  ADD COLUMN IF NOT EXISTS snapshot_id uuid NULL REFERENCES public.governance_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_fingerprint text NULL,
  ADD COLUMN IF NOT EXISTS readiness_status text NULL,
  ADD COLUMN IF NOT EXISTS readiness_score numeric NULL,
  ADD COLUMN IF NOT EXISTS governance_calculated_at timestamptz NULL;

COMMENT ON COLUMN public.execution_decisions.snapshot_id IS 'Governance snapshot that allowed this decision (audit trail).';
COMMENT ON COLUMN public.execution_decisions.policy_fingerprint IS 'Policy fingerprint at time of decision (from governance_events).';
COMMENT ON COLUMN public.execution_decisions.readiness_status IS 'Readiness status at time of decision (GO/WARNING/NO_GO).';
COMMENT ON COLUMN public.execution_decisions.readiness_score IS 'Readiness score at time of decision.';
COMMENT ON COLUMN public.execution_decisions.governance_calculated_at IS 'When readiness was calculated (from governance snapshot).';

CREATE INDEX IF NOT EXISTS idx_execution_decisions_org_snapshot_id
  ON public.execution_decisions (org_id, snapshot_id);
