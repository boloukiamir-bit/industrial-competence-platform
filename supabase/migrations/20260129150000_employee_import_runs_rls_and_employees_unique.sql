-- Extend employee_import_runs with created_by, stats, error_report and RLS.
-- Ensure employees has unique (org_id, employee_number) for tenant-scoped upsert.

-- 1. Add columns to employee_import_runs
ALTER TABLE public.employee_import_runs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rows_imported integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rows_failed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_report jsonb;

CREATE INDEX IF NOT EXISTS idx_employee_import_runs_created_by ON public.employee_import_runs(created_by);

-- 2. Ensure employees can be upserted by (org_id, employee_number)
-- Add composite unique; drop legacy global unique on employee_number if present.
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

-- 3. RLS on employee_import_runs: org-scoped via active_org_id and created_by
ALTER TABLE public.employee_import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_import_runs_select" ON public.employee_import_runs;
CREATE POLICY "employee_import_runs_select" ON public.employee_import_runs
  FOR SELECT
  USING (
    organization_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "employee_import_runs_insert" ON public.employee_import_runs;
CREATE POLICY "employee_import_runs_insert" ON public.employee_import_runs
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "employee_import_runs_update" ON public.employee_import_runs;
CREATE POLICY "employee_import_runs_update" ON public.employee_import_runs
  FOR UPDATE
  USING (
    organization_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    AND created_by = auth.uid()
  );
