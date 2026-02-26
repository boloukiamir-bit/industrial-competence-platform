-- execution_decisions: linked_job_id and decision_type values for cockpit.
ALTER TABLE public.execution_decisions ADD COLUMN IF NOT EXISTS linked_job_id uuid NULL REFERENCES public.hr_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.execution_decisions DROP CONSTRAINT IF EXISTS execution_decisions_decision_type_check;

-- Remove rows with unknown decision_type so the new constraint can be applied.
-- (Updating them to a single value would violate ux_execution_decisions_active_unique.)
DELETE FROM public.execution_decisions
WHERE decision_type IS NULL
   OR decision_type NOT IN (
     'resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate',
     'station_issue', 'acknowledged_station_issue', 'acknowledged', 'plan_training',
     'ACKNOWLEDGED', 'OVERRIDDEN', 'DEFERRED', 'RESOLVED'
   );

-- Dedupe: keep one per (decision_type, target_type, target_id).
DELETE FROM public.execution_decisions a USING public.execution_decisions b
WHERE a.decision_type = b.decision_type AND a.target_type = b.target_type AND a.target_id = b.target_id AND a.id < b.id;

ALTER TABLE public.execution_decisions ADD CONSTRAINT execution_decisions_decision_type_check CHECK (decision_type IN ('resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate', 'station_issue', 'acknowledged_station_issue', 'acknowledged', 'plan_training', 'ACKNOWLEDGED', 'OVERRIDDEN', 'DEFERRED', 'RESOLVED'));
