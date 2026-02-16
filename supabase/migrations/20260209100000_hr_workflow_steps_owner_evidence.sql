-- Steps editor v1: owner_role and evidence_required on hr_workflow_steps.
-- owner_role: who is responsible (Ops, Supervisor, HR). evidence_required: whether step requires evidence.

ALTER TABLE public.hr_workflow_steps
  ADD COLUMN IF NOT EXISTS owner_role text DEFAULT 'HR',
  ADD COLUMN IF NOT EXISTS evidence_required boolean NOT NULL DEFAULT false;

UPDATE public.hr_workflow_steps
SET owner_role = 'HR'
WHERE owner_role IS NULL;

ALTER TABLE public.hr_workflow_steps
  ALTER COLUMN owner_role SET DEFAULT 'HR';

-- Constrain to allowed values (case-insensitive in app; store canonical)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hr_workflow_steps_owner_role_check'
  ) THEN
    ALTER TABLE public.hr_workflow_steps
      ADD CONSTRAINT hr_workflow_steps_owner_role_check
      CHECK (owner_role IN ('Ops', 'Supervisor', 'HR'));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    NULL;
END $$;
