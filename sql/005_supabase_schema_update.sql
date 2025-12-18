-- =============================================================================
-- SUPABASE SCHEMA UPDATE - Run this in Supabase SQL Editor
-- =============================================================================
-- This migration adds multi-tenant columns and tables required for Nadiplan.
-- Run this in your Supabase Dashboard > SQL Editor
-- =============================================================================

-- 1. CREATE ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. CREATE MEMBERSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'hr', 'manager', 'user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_org_id_idx ON public.memberships(org_id);

-- 3. CREATE ORG_UNITS TABLE
CREATE TABLE IF NOT EXISTS public.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  parent_id uuid REFERENCES public.org_units(id),
  type text,
  manager_employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_units_org_id_idx ON public.org_units(org_id);

-- 4. ADD COLUMNS TO EMPLOYEES TABLE
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'permanent';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS country text DEFAULT 'Sweden';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_end_date date;

CREATE INDEX IF NOT EXISTS employees_org_id_idx ON public.employees(org_id);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR EMPLOYEES
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
CREATE POLICY "employees_select_policy" ON public.employees
  FOR SELECT
  USING (
    org_id IS NULL OR
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

-- 7. RLS POLICIES FOR ORG_UNITS
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

-- 8. CREATE A DEFAULT DEMO ORGANIZATION (optional)
INSERT INTO public.organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Company', 'demo-company')
ON CONFLICT (slug) DO NOTHING;

-- 9. REFRESH THE SCHEMA CACHE
-- After running this migration, go to Database > API in Supabase Dashboard
-- and click "Reload" to refresh the PostgREST schema cache

SELECT 'Migration complete! Remember to refresh the schema cache in Supabase Dashboard.' as status;
