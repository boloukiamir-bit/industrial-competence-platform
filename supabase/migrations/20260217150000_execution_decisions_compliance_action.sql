-- Allow compliance_action decisions (Compliance 2.0 Executive Board action engine).
DO $$
BEGIN
  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_decision_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_decision_type_check
    CHECK (decision_type IN (
      'resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate',
      'station_issue', 'acknowledged_station_issue', 'plan_training', 'compliance_action', 'competence_action'
    ));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
