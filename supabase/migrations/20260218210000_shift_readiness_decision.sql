-- Shift readiness governance: one decision per org+site+shift (execution_decisions).
-- Data hygiene: normalize and map legacy values before adding CHECK constraints (avoids 23514).

-- 1) target_type: normalize case/format
UPDATE public.execution_decisions
SET target_type = LOWER(REPLACE(REPLACE(target_type, '-', '_'), ' ', '_'))
WHERE target_type IS NOT NULL;

-- Map common aliases to canonical
UPDATE public.execution_decisions
SET target_type = 'line_shift'
WHERE target_type IN ('line', 'line_shift', 'lineshift');

UPDATE public.execution_decisions
SET target_type = 'station_shift'
WHERE target_type IN ('station', 'station_shift', 'stationshift');

UPDATE public.execution_decisions
SET target_type = 'shift_assignment'
WHERE target_type IN ('shiftassignment', 'shift_assign', 'assignment_shift');

-- Force invalid/NULL to 'unknown' so constraint can be applied
UPDATE public.execution_decisions
SET target_type = 'unknown'
WHERE target_type IS NULL
   OR target_type NOT IN ('line_shift', 'assignment', 'employee', 'shift_assignment', 'station_shift', 'shift_readiness', 'unknown');

-- 2) decision_type: normalize to lowercase snake_case
UPDATE public.execution_decisions
SET decision_type = LOWER(REPLACE(REPLACE(decision_type, '-', '_'), ' ', '_'))
WHERE decision_type IS NOT NULL;

-- Force invalid/NULL to 'unknown'
UPDATE public.execution_decisions
SET decision_type = 'unknown'
WHERE decision_type IS NULL
   OR decision_type NOT IN (
      'resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate',
      'station_issue', 'acknowledged_station_issue', 'plan_training', 'compliance_action', 'competence_action',
      'hr_template_job_created', 'hr_template_job_updated', 'hr_template_job_status', 'hr_template_job_owner',
      'shift_readiness', 'unknown'
   );

-- 3) Add constraints (include 'unknown' for legacy rows)
DO $$
BEGIN
  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_decision_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_decision_type_check
    CHECK (decision_type IN (
      'resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate',
      'station_issue', 'acknowledged_station_issue', 'plan_training', 'compliance_action', 'competence_action',
      'hr_template_job_created', 'hr_template_job_updated', 'hr_template_job_status', 'hr_template_job_owner',
      'shift_readiness', 'unknown'
    ));

  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_target_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_target_type_check
    CHECK (target_type IN (
      'line_shift', 'assignment', 'employee', 'shift_assignment', 'station_shift', 'shift_readiness', 'unknown'
    ));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

COMMENT ON CONSTRAINT execution_decisions_decision_type_check ON public.execution_decisions IS 'Includes shift_readiness for cockpit readiness acknowledge/override/stop.';
