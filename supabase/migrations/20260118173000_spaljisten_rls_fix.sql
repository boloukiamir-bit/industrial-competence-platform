-- P0-1: Spaljisten RLS Security Fix
-- Replace USING (TRUE) with proper org-scoped policies

-- ============================================================================
-- HELPER FUNCTIONS (create or replace)
-- ============================================================================

-- Check if current user is a member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = check_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Check if current user is an admin/HR of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = check_org_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'hr')
      AND status = 'active'
  );
$$;

-- ============================================================================
-- DROP OLD POLICIES
-- ============================================================================

-- Drop all existing USING (TRUE) policies on sp_* tables
DROP POLICY IF EXISTS sp_rating_scales_select ON sp_rating_scales;
DROP POLICY IF EXISTS sp_rating_scales_all ON sp_rating_scales;
DROP POLICY IF EXISTS sp_areas_select ON sp_areas;
DROP POLICY IF EXISTS sp_areas_all ON sp_areas;
DROP POLICY IF EXISTS sp_stations_select ON sp_stations;
DROP POLICY IF EXISTS sp_stations_all ON sp_stations;
DROP POLICY IF EXISTS sp_skills_select ON sp_skills;
DROP POLICY IF EXISTS sp_skills_all ON sp_skills;
DROP POLICY IF EXISTS sp_employees_select ON sp_employees;
DROP POLICY IF EXISTS sp_employees_all ON sp_employees;
DROP POLICY IF EXISTS sp_employee_skills_select ON sp_employee_skills;
DROP POLICY IF EXISTS sp_employee_skills_all ON sp_employee_skills;
DROP POLICY IF EXISTS sp_area_leaders_select ON sp_area_leaders;
DROP POLICY IF EXISTS sp_area_leaders_all ON sp_area_leaders;
DROP POLICY IF EXISTS sp_import_logs_select ON sp_import_logs;
DROP POLICY IF EXISTS sp_import_logs_all ON sp_import_logs;

-- ============================================================================
-- SP_RATING_SCALES: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_rating_scales_select ON sp_rating_scales
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_rating_scales_insert ON sp_rating_scales
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_rating_scales_update ON sp_rating_scales
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_rating_scales_delete ON sp_rating_scales
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_AREAS: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_areas_select ON sp_areas
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_areas_insert ON sp_areas
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_areas_update ON sp_areas
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_areas_delete ON sp_areas
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_STATIONS: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_stations_select ON sp_stations
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_stations_insert ON sp_stations
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_stations_update ON sp_stations
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_stations_delete ON sp_stations
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_SKILLS: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_skills_select ON sp_skills
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_skills_insert ON sp_skills
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_skills_update ON sp_skills
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_skills_delete ON sp_skills
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_EMPLOYEES: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_employees_select ON sp_employees
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_employees_insert ON sp_employees
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_employees_update ON sp_employees
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_employees_delete ON sp_employees
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_EMPLOYEE_SKILLS: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_employee_skills_select ON sp_employee_skills
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_employee_skills_insert ON sp_employee_skills
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_employee_skills_update ON sp_employee_skills
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_employee_skills_delete ON sp_employee_skills
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_AREA_LEADERS: Members can read, admins/HR can write
-- ============================================================================
CREATE POLICY sp_area_leaders_select ON sp_area_leaders
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY sp_area_leaders_insert ON sp_area_leaders
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_area_leaders_update ON sp_area_leaders
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_area_leaders_delete ON sp_area_leaders
  FOR DELETE USING (public.is_org_admin(org_id));

-- ============================================================================
-- SP_IMPORT_LOGS: Admins/HR only (audit trail)
-- ============================================================================
CREATE POLICY sp_import_logs_select ON sp_import_logs
  FOR SELECT USING (public.is_org_admin(org_id));

CREATE POLICY sp_import_logs_insert ON sp_import_logs
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_import_logs_update ON sp_import_logs
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY sp_import_logs_delete ON sp_import_logs
  FOR DELETE USING (public.is_org_admin(org_id));
