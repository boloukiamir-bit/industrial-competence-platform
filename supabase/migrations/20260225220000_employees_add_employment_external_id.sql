-- Add HR external employment id (Anst.id) to employees for import matching.
-- Backfill where employee_number is all digits (best-effort).

-- 1) Column
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_external_id text NULL;

COMMENT ON COLUMN public.employees.employment_external_id IS 'HR master Anst.id; used for fixed-term and other HR imports.';

-- 2) Unique index: one HR id per org (prevents duplicate matches)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_org_employment_external_id
  ON public.employees(org_id, employment_external_id)
  WHERE employment_external_id IS NOT NULL;

-- 3) Index on (org_id, employee_number) for lookups if not already covered
CREATE INDEX IF NOT EXISTS idx_employees_org_employee_number
  ON public.employees(org_id, employee_number);

-- 4) Backfill: where employee_number is all digits (HR Anst.id), set employment_external_id = trim(employee_number)
UPDATE public.employees
SET employment_external_id = trim(employee_number)
WHERE employment_external_id IS NULL
  AND employee_number IS NOT NULL
  AND trim(employee_number) <> ''
  AND trim(employee_number) ~ '^[0-9]+$';
