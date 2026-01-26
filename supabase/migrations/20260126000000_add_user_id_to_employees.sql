-- Add user_id column to employees table for linking auth.users to employees
-- This enables Employee Dashboard to resolve the logged-in user's employee record

ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for efficient lookups: find employee by user_id within an org
CREATE INDEX IF NOT EXISTS idx_employees_org_user 
  ON public.employees(org_id, user_id) 
  WHERE user_id IS NOT NULL;

-- Index for email-based fallback lookup (if employees.email exists)
-- Note: This assumes employees.email column exists. If not, this will be a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'email'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_employees_org_email 
      ON public.employees(org_id, email) 
      WHERE email IS NOT NULL;
  END IF;
END $$;
