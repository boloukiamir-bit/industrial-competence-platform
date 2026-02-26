-- Employee Lifecycle v1 (deterministic, audit-proof)

-- 1) Columns (idempotent-ish via IF NOT EXISTS where possible)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS employment_status text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS hire_date date;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS termination_date date;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS status_changed_by uuid;

-- Defaults + constraints
UPDATE public.employees
SET employment_status = 'ACTIVE'
WHERE employment_status IS NULL;

ALTER TABLE public.employees
ALTER COLUMN employment_status SET NOT NULL;

ALTER TABLE public.employees
ALTER COLUMN employment_status SET DEFAULT 'ACTIVE';

DO $$
BEGIN
  -- Add CHECK constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_employment_status_check'
  ) THEN
    ALTER TABLE public.employees
    ADD CONSTRAINT employees_employment_status_check
    CHECK (employment_status IN ('ACTIVE','INACTIVE','TERMINATED','ARCHIVED'));
  END IF;
END $$;

-- Backfill hire_date deterministically
UPDATE public.employees
SET hire_date = CURRENT_DATE
WHERE hire_date IS NULL;

ALTER TABLE public.employees
ALTER COLUMN hire_date SET NOT NULL;

-- status_changed_at default + backfill
UPDATE public.employees
SET status_changed_at = now()
WHERE status_changed_at IS NULL;

ALTER TABLE public.employees
ALTER COLUMN status_changed_at SET NOT NULL;

ALTER TABLE public.employees
ALTER COLUMN status_changed_at SET DEFAULT now();

-- 2) Transition guard trigger
CREATE OR REPLACE FUNCTION public.validate_employee_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
    -- No resurrection
    IF OLD.employment_status = 'TERMINATED' AND NEW.employment_status = 'ACTIVE' THEN
      RAISE EXCEPTION 'Illegal transition: TERMINATED → ACTIVE not allowed';
    END IF;

    -- Archived is terminal
    IF OLD.employment_status = 'ARCHIVED' AND NEW.employment_status <> 'ARCHIVED' THEN
      RAISE EXCEPTION 'Illegal transition: ARCHIVED is final state';
    END IF;

    NEW.status_changed_at = now();
    -- status_changed_by is set by API layer later (keep nullable for now)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_employee_status_transition ON public.employees;

CREATE TRIGGER trg_validate_employee_status_transition
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.validate_employee_status_transition();

-- 3) Governance event logging on status change
-- Uses existing governance_events schema: action, target_type, outcome, legitimacy_status, readiness_status, meta
CREATE OR REPLACE FUNCTION public.log_employee_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
    INSERT INTO public.governance_events (
      org_id,
      site_id,
      action,
      target_type,
      target_id,
      outcome,
      legitimacy_status,
      readiness_status,
      reason_codes,
      meta,
      created_at
    )
    VALUES (
      NEW.org_id,
      NEW.site_id,
      'EMPLOYMENT_STATUS_CHANGE',
      'employee',
      NEW.id::text,
      'RECORDED',
      'RECORDED',
      'RECORDED',
      '{}',
      jsonb_build_object(
        'category', 'EMPLOYMENT_LIFECYCLE',
        'severity', 'INFO',
        'impact', 'NON_BLOCKING',
        'employee_id', NEW.id,
        'from', OLD.employment_status,
        'to', NEW.employment_status
      ),
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
