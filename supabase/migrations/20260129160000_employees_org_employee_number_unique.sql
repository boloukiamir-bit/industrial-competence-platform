-- Fix employees unique: allow same employee_number in different orgs (tenant-scoped).
-- Drop legacy global unique on employee_number; ensure composite (org_id, employee_number).

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employee_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass AND conname = 'employees_org_id_employee_number_key'
  ) THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_org_id_employee_number_key UNIQUE (org_id, employee_number);
  END IF;
END $$;
