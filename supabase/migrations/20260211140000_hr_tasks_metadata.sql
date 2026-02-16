-- Persist compliance/context on HR tasks (e.g. from Cockpit "Create HR task" when ILLEGAL).
-- RLS unchanged: SELECT still org members, INSERT/UPDATE/DELETE still admin/hr.

ALTER TABLE public.hr_tasks
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hr_tasks.metadata IS 'Optional context: station_id, station_name, shift_code, issue_severity, compliance_risk_points, blockers[].';
