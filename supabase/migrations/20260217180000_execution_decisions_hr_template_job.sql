-- Allow hr_template_job_* decision types in execution_decisions.
DO $$
BEGIN
  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_decision_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_decision_type_check
    CHECK (decision_type IN (
      'resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate',
      'station_issue', 'acknowledged_station_issue', 'plan_training', 'compliance_action', 'competence_action',
      'hr_template_job_created', 'hr_template_job_updated', 'hr_template_job_status', 'hr_template_job_owner'
    ));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
