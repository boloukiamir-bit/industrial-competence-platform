-- Create employee_import_runs table for tracking import batches
CREATE TABLE IF NOT EXISTS public.employee_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.org_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  employee_count integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_employee_import_runs_org ON public.employee_import_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_import_runs_created ON public.employee_import_runs(created_at DESC);

-- Add import_run_id column to employees (replaces/extends import_batch_id)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS import_run_id uuid REFERENCES public.employee_import_runs(id) ON DELETE SET NULL;

-- Keep import_batch_id for backward compatibility, but prefer import_run_id
CREATE INDEX IF NOT EXISTS idx_employees_import_run_id ON public.employees(import_run_id);

-- Ensure is_active column exists (should already exist, but make sure)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Ensure org_id column exists and is indexed
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_org_id ON public.employees(org_id);
