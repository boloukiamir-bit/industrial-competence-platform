-- Patch: Employee Lifecycle governance trigger must match public.governance_events schema

CREATE OR REPLACE FUNCTION public.log_employee_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_idempotency text;
BEGIN
  IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
    v_idempotency :=
      'EMP_STATUS:' || NEW.id::text || ':' ||
      OLD.employment_status || '->' || NEW.employment_status || ':' ||
      to_char(NEW.status_changed_at, 'YYYYMMDDHH24MISSMS');

    INSERT INTO public.governance_events (
      org_id,
      site_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      outcome,
      legitimacy_status,
      readiness_status,
      reason_codes,
      meta,
      idempotency_key,
      created_at
    )
    VALUES (
      NEW.org_id,
      NEW.site_id,
      NEW.status_changed_by,
      'EMPLOYMENT_STATUS_CHANGE',
      'EMPLOYEE',
      NEW.id::text,
      'RECORDED',
      'OK',
      'NON_BLOCKING',
      ARRAY['EMPLOYMENT_LIFECYCLE'],
      jsonb_build_object(
        'employee_id', NEW.id,
        'from', OLD.employment_status,
        'to', NEW.employment_status
      ),
      v_idempotency,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_employee_status_change ON public.employees;

CREATE TRIGGER trg_log_employee_status_change
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.log_employee_status_change();

/*
  Verification (run after migration):

  1) Update one employee to INACTIVE:
     UPDATE public.employees
     SET employment_status = 'INACTIVE'
     WHERE id = '<some employee uuid>'
     RETURNING id, employment_status, status_changed_at;

  2) Query governance_events for that employee:
     SELECT action, target_type, target_id, outcome, legitimacy_status, readiness_status, reason_codes, meta, created_at
     FROM public.governance_events
     WHERE action = 'EMPLOYMENT_STATUS_CHANGE' AND target_id = '<same id>'
     ORDER BY created_at DESC
     LIMIT 5;

  Expected: one row with action='EMPLOYMENT_STATUS_CHANGE', target_type='EMPLOYEE',
  target_id=<employee uuid>, readiness_status='NON_BLOCKING', meta containing from/to and employee_id.
*/
