-- Migration: Fix org schema for employees and org_units
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE ORG_UNITS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  parent_id uuid REFERENCES public.org_units(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_units_org_id_idx ON public.org_units(org_id);

-- ============================================
-- 2. ADD ORG_ID TO EMPLOYEES (if missing)
-- ============================================
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_id uuid;

-- ============================================
-- 3. BACKFILL ORG_ID
-- ============================================
-- Option A: Set org_id from memberships (if user context available)
-- UPDATE public.employees
-- SET org_id = (SELECT m.org_id FROM public.memberships m WHERE m.user_id = auth.uid() LIMIT 1)
-- WHERE org_id IS NULL;

-- Option B: Manually paste your org_id here and run this:
-- Replace 'YOUR_ORG_ID_HERE' with actual org UUID from organizations table
-- Example: SELECT id FROM organizations LIMIT 1;
--
-- UPDATE public.employees
-- SET org_id = 'YOUR_ORG_ID_HERE'::uuid
-- WHERE org_id IS NULL;

-- ============================================
-- 4. MAKE ORG_ID NOT NULL (after backfill)
-- ============================================
-- Only run this AFTER you've confirmed all employees have org_id set:
-- ALTER TABLE public.employees ALTER COLUMN org_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS employees_org_id_idx ON public.employees(org_id);

-- Add foreign key constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'employees_org_id_fkey' 
    AND table_name = 'employees'
  ) THEN
    ALTER TABLE public.employees 
    ADD CONSTRAINT employees_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. ENABLE RLS
-- ============================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES FOR EMPLOYEES
-- ============================================
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
CREATE POLICY "employees_select_policy" ON public.employees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "employees_insert_policy" ON public.employees;
CREATE POLICY "employees_insert_policy" ON public.employees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "employees_update_policy" ON public.employees;
CREATE POLICY "employees_update_policy" ON public.employees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "employees_delete_policy" ON public.employees;
CREATE POLICY "employees_delete_policy" ON public.employees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role = 'admin'
    )
  );

-- ============================================
-- 7. RLS POLICIES FOR ORG_UNITS
-- ============================================
DROP POLICY IF EXISTS "org_units_select_policy" ON public.org_units;
CREATE POLICY "org_units_select_policy" ON public.org_units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "org_units_insert_policy" ON public.org_units;
CREATE POLICY "org_units_insert_policy" ON public.org_units
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "org_units_update_policy" ON public.org_units;
CREATE POLICY "org_units_update_policy" ON public.org_units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "org_units_delete_policy" ON public.org_units;
CREATE POLICY "org_units_delete_policy" ON public.org_units
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role = 'admin'
    )
  );

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================
-- Check org_units exists:
-- SELECT * FROM information_schema.tables WHERE table_name = 'org_units';

-- Check employees has org_id:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'org_id';

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('employees', 'org_units');

-- Count null org_ids:
-- SELECT COUNT(*) FROM employees WHERE org_id IS NULL;
