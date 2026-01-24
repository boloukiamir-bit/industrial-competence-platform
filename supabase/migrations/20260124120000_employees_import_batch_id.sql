-- Add import_batch_id to employees for sandbox import isolation.
-- Rows from a given CSV import share the same batch id; Employees page can filter by latest.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS import_batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_employees_import_batch_id ON public.employees(import_batch_id);
