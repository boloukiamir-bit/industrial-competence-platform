-- RLS Policies for employees and org_units tables
-- Run this migration to enable Row Level Security

-- 1. Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on org_units table  
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;

-- 3. Create SELECT policy for employees
-- Users can view employees in organizations where they have active membership
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
CREATE POLICY "employees_select_policy" ON employees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
    )
  );

-- 4. Create INSERT policy for employees (admin/hr only)
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
CREATE POLICY "employees_insert_policy" ON employees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

-- 5. Create UPDATE policy for employees (admin/hr only)
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
CREATE POLICY "employees_update_policy" ON employees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

-- 6. Create DELETE policy for employees (admin only)
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;
CREATE POLICY "employees_delete_policy" ON employees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = employees.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role = 'admin'
    )
  );

-- 7. Create SELECT policy for org_units
DROP POLICY IF EXISTS "org_units_select_policy" ON org_units;
CREATE POLICY "org_units_select_policy" ON org_units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
    )
  );

-- 8. Create INSERT policy for org_units (admin/hr only)
DROP POLICY IF EXISTS "org_units_insert_policy" ON org_units;
CREATE POLICY "org_units_insert_policy" ON org_units
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

-- 9. Create UPDATE policy for org_units (admin/hr only)
DROP POLICY IF EXISTS "org_units_update_policy" ON org_units;
CREATE POLICY "org_units_update_policy" ON org_units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role IN ('admin', 'hr')
    )
  );

-- 10. Create DELETE policy for org_units (admin only)
DROP POLICY IF EXISTS "org_units_delete_policy" ON org_units;
CREATE POLICY "org_units_delete_policy" ON org_units
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m 
      WHERE m.org_id = org_units.org_id 
      AND m.user_id = auth.uid() 
      AND m.status = 'active'
      AND m.role = 'admin'
    )
  );
