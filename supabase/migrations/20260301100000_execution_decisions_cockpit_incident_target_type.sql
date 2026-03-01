-- execution_decisions: allow target_type COCKPIT_INCIDENT for incident decision route.
-- Idempotency for COCKPIT_INCIDENT is enforced by (org_id, root_cause->>'idempotency_key').

DO $$
BEGIN
  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_target_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_target_type_check
    CHECK (target_type IN (
      'line_shift', 'assignment', 'employee', 'shift_assignment', 'station_shift', 'COCKPIT_INCIDENT'
    ));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Idempotency: one row per (org_id, idempotency_key) for COCKPIT_INCIDENT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_decisions_cockpit_incident_idempotency
  ON public.execution_decisions (org_id, ((root_cause->>'idempotency_key')))
  WHERE target_type = 'COCKPIT_INCIDENT' AND root_cause->>'idempotency_key' IS NOT NULL;

COMMENT ON INDEX public.idx_execution_decisions_cockpit_incident_idempotency IS
  'Enforces one incident decision per idempotency_key per org; used by POST /api/cockpit/decisions/incident.';
