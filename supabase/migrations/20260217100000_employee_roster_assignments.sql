-- employee_roster_assignments: master roster data per org/site for real roster pipeline.
-- CSV columns: anst_id, name, role, area, station_name, station_code, legacy_line_id, shift_raw, shift_code, leader_name.
-- Import writes here; apply uses this to populate shift_assignments.employee_id.
CREATE TABLE IF NOT EXISTS public.employee_roster_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  employee_anst_id text NOT NULL,
  employee_name text,
  role text,
  area text,
  station_code text,
  station_name text,
  legacy_line_id text,
  shift_raw text,
  shift_code text,
  leader_name text,
  station_id uuid REFERENCES public.stations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, site_id, employee_anst_id, station_code, shift_code)
);

CREATE INDEX IF NOT EXISTS idx_employee_roster_assignments_org_site
  ON public.employee_roster_assignments(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_employee_roster_assignments_shift_code
  ON public.employee_roster_assignments(org_id, site_id, shift_code);

ALTER TABLE public.employee_roster_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_roster_assignments_select" ON public.employee_roster_assignments;
CREATE POLICY "employee_roster_assignments_select" ON public.employee_roster_assignments
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_roster_assignments_insert" ON public.employee_roster_assignments;
CREATE POLICY "employee_roster_assignments_insert" ON public.employee_roster_assignments
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_roster_assignments_update" ON public.employee_roster_assignments;
CREATE POLICY "employee_roster_assignments_update" ON public.employee_roster_assignments
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_roster_assignments_delete" ON public.employee_roster_assignments;
CREATE POLICY "employee_roster_assignments_delete" ON public.employee_roster_assignments
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

COMMENT ON TABLE public.employee_roster_assignments IS 'Master roster rows per org/site; import from CSV; apply copies to shift_assignments.employee_id for a date+shift.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roster_assignments TO authenticated;
