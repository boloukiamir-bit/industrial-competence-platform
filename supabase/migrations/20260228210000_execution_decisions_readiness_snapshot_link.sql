-- Execution-bound freeze: link execution_decisions to readiness_snapshots for audit.
-- When a decision is created for a shift context, a readiness snapshot is created/reused and linked.

ALTER TABLE public.execution_decisions
  ADD COLUMN IF NOT EXISTS readiness_snapshot_id uuid NULL REFERENCES public.readiness_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_execution_decisions_readiness_snapshot_id
  ON public.execution_decisions(readiness_snapshot_id);

COMMENT ON COLUMN public.execution_decisions.readiness_snapshot_id IS 'Readiness snapshot (execution freeze) at decision time; set when decision is execution-bound (shift context + RESOLVED/OVERRIDDEN/ACKNOWLEDGED/DEFERRED).';
