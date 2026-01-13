-- ============================
-- Production Leader OS - Schema Migration
-- Multi-tenant tables with RLS for Supabase
-- Run in Supabase SQL Editor (Schema tab)
-- ============================

-- Departments (production areas)
CREATE TABLE IF NOT EXISTS public.pl_departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_code text NOT NULL,
  department_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, department_code)
);

-- Production lines within departments
CREATE TABLE IF NOT EXISTS public.pl_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_code text NOT NULL,
  line_name text NOT NULL,
  department_code text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, line_code)
);

-- Machines/stations within lines
CREATE TABLE IF NOT EXISTS public.pl_machines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  machine_code text NOT NULL,
  machine_name text NOT NULL,
  line_code text NOT NULL,
  machine_type text,
  is_critical boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, machine_code)
);

-- Production employees
CREATE TABLE IF NOT EXISTS public.pl_employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  department_code text,
  default_line_code text,
  employment_type text,
  weekly_capacity_hours numeric DEFAULT 40,
  manager_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_code)
);

-- Shift templates (Day/Evening/Night per weekday)
CREATE TABLE IF NOT EXISTS public.pl_shift_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  weekday int NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, shift_type, weekday)
);

-- Crew definitions
CREATE TABLE IF NOT EXISTS public.pl_crews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  crew_code text NOT NULL,
  crew_name text NOT NULL,
  default_department_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, crew_code)
);

-- Crew membership
CREATE TABLE IF NOT EXISTS public.pl_crew_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  crew_code text NOT NULL,
  employee_code text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT null DEFAULT now(),
  UNIQUE (org_id, crew_code, employee_code)
);

-- Crew rotation rules (which shift each week)
CREATE TABLE IF NOT EXISTS public.pl_crew_rotation_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  crew_code text NOT NULL,
  cycle_length_weeks int NOT NULL CHECK (cycle_length_weeks BETWEEN 1 AND 8),
  week_in_cycle int NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, crew_code, cycle_length_weeks, week_in_cycle)
);

-- Daily attendance records
CREATE TABLE IF NOT EXISTS public.pl_attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  employee_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('present','absent','partial')),
  available_from time,
  available_to time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, plan_date, shift_type, employee_code)
);

-- Machine demand for planning
CREATE TABLE IF NOT EXISTS public.pl_machine_demand (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  machine_code text NOT NULL,
  required_hours numeric NOT NULL,
  priority int NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, plan_date, shift_type, machine_code)
);

-- Employee assignments to machines (time segments)
CREATE TABLE IF NOT EXISTS public.pl_assignment_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  machine_code text NOT NULL,
  employee_code text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  role_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Overtime and override records
CREATE TABLE IF NOT EXISTS public.pl_overtime_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  employee_code text NOT NULL,
  machine_code text,
  start_time time,
  end_time time,
  hours numeric,
  reason text,
  approved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pl_departments_org ON public.pl_departments(org_id);
CREATE INDEX IF NOT EXISTS idx_pl_lines_org ON public.pl_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_pl_machines_org ON public.pl_machines(org_id);
CREATE INDEX IF NOT EXISTS idx_pl_employees_org ON public.pl_employees(org_id);
CREATE INDEX IF NOT EXISTS idx_pl_attendance_org_date ON public.pl_attendance(org_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_pl_machine_demand_org_date ON public.pl_machine_demand(org_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_pl_assignment_segments_org_date ON public.pl_assignment_segments(org_id, plan_date);

-- Enable RLS on all tables
ALTER TABLE public.pl_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_crew_rotation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_machine_demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_assignment_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_overtime_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Members can read, admins can write
-- pl_departments
DROP POLICY IF EXISTS "pl_departments_select" ON public.pl_departments;
CREATE POLICY "pl_departments_select" ON public.pl_departments FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_departments_insert" ON public.pl_departments;
CREATE POLICY "pl_departments_insert" ON public.pl_departments FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_departments_update" ON public.pl_departments;
CREATE POLICY "pl_departments_update" ON public.pl_departments FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_departments_delete" ON public.pl_departments;
CREATE POLICY "pl_departments_delete" ON public.pl_departments FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_lines
DROP POLICY IF EXISTS "pl_lines_select" ON public.pl_lines;
CREATE POLICY "pl_lines_select" ON public.pl_lines FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_lines_insert" ON public.pl_lines;
CREATE POLICY "pl_lines_insert" ON public.pl_lines FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_lines_update" ON public.pl_lines;
CREATE POLICY "pl_lines_update" ON public.pl_lines FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_lines_delete" ON public.pl_lines;
CREATE POLICY "pl_lines_delete" ON public.pl_lines FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_machines
DROP POLICY IF EXISTS "pl_machines_select" ON public.pl_machines;
CREATE POLICY "pl_machines_select" ON public.pl_machines FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_machines_insert" ON public.pl_machines;
CREATE POLICY "pl_machines_insert" ON public.pl_machines FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_machines_update" ON public.pl_machines;
CREATE POLICY "pl_machines_update" ON public.pl_machines FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_machines_delete" ON public.pl_machines;
CREATE POLICY "pl_machines_delete" ON public.pl_machines FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_employees
DROP POLICY IF EXISTS "pl_employees_select" ON public.pl_employees;
CREATE POLICY "pl_employees_select" ON public.pl_employees FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_employees_insert" ON public.pl_employees;
CREATE POLICY "pl_employees_insert" ON public.pl_employees FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_employees_update" ON public.pl_employees;
CREATE POLICY "pl_employees_update" ON public.pl_employees FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_employees_delete" ON public.pl_employees;
CREATE POLICY "pl_employees_delete" ON public.pl_employees FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_shift_templates
DROP POLICY IF EXISTS "pl_shift_templates_select" ON public.pl_shift_templates;
CREATE POLICY "pl_shift_templates_select" ON public.pl_shift_templates FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_shift_templates_insert" ON public.pl_shift_templates;
CREATE POLICY "pl_shift_templates_insert" ON public.pl_shift_templates FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_shift_templates_update" ON public.pl_shift_templates;
CREATE POLICY "pl_shift_templates_update" ON public.pl_shift_templates FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_shift_templates_delete" ON public.pl_shift_templates;
CREATE POLICY "pl_shift_templates_delete" ON public.pl_shift_templates FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_crews
DROP POLICY IF EXISTS "pl_crews_select" ON public.pl_crews;
CREATE POLICY "pl_crews_select" ON public.pl_crews FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_crews_insert" ON public.pl_crews;
CREATE POLICY "pl_crews_insert" ON public.pl_crews FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_crews_update" ON public.pl_crews;
CREATE POLICY "pl_crews_update" ON public.pl_crews FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_crews_delete" ON public.pl_crews;
CREATE POLICY "pl_crews_delete" ON public.pl_crews FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_crew_members
DROP POLICY IF EXISTS "pl_crew_members_select" ON public.pl_crew_members;
CREATE POLICY "pl_crew_members_select" ON public.pl_crew_members FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_crew_members_insert" ON public.pl_crew_members;
CREATE POLICY "pl_crew_members_insert" ON public.pl_crew_members FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_crew_members_update" ON public.pl_crew_members;
CREATE POLICY "pl_crew_members_update" ON public.pl_crew_members FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_crew_members_delete" ON public.pl_crew_members;
CREATE POLICY "pl_crew_members_delete" ON public.pl_crew_members FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_crew_rotation_rules
DROP POLICY IF EXISTS "pl_crew_rotation_rules_select" ON public.pl_crew_rotation_rules;
CREATE POLICY "pl_crew_rotation_rules_select" ON public.pl_crew_rotation_rules FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_crew_rotation_rules_insert" ON public.pl_crew_rotation_rules;
CREATE POLICY "pl_crew_rotation_rules_insert" ON public.pl_crew_rotation_rules FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_crew_rotation_rules_update" ON public.pl_crew_rotation_rules;
CREATE POLICY "pl_crew_rotation_rules_update" ON public.pl_crew_rotation_rules FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "pl_crew_rotation_rules_delete" ON public.pl_crew_rotation_rules;
CREATE POLICY "pl_crew_rotation_rules_delete" ON public.pl_crew_rotation_rules FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_attendance (managers can also write)
DROP POLICY IF EXISTS "pl_attendance_select" ON public.pl_attendance;
CREATE POLICY "pl_attendance_select" ON public.pl_attendance FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_attendance_insert" ON public.pl_attendance;
CREATE POLICY "pl_attendance_insert" ON public.pl_attendance FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_attendance_update" ON public.pl_attendance;
CREATE POLICY "pl_attendance_update" ON public.pl_attendance FOR UPDATE
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_attendance_delete" ON public.pl_attendance;
CREATE POLICY "pl_attendance_delete" ON public.pl_attendance FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_machine_demand
DROP POLICY IF EXISTS "pl_machine_demand_select" ON public.pl_machine_demand;
CREATE POLICY "pl_machine_demand_select" ON public.pl_machine_demand FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_machine_demand_insert" ON public.pl_machine_demand;
CREATE POLICY "pl_machine_demand_insert" ON public.pl_machine_demand FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_machine_demand_update" ON public.pl_machine_demand;
CREATE POLICY "pl_machine_demand_update" ON public.pl_machine_demand FOR UPDATE
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_machine_demand_delete" ON public.pl_machine_demand;
CREATE POLICY "pl_machine_demand_delete" ON public.pl_machine_demand FOR DELETE
  USING (public.is_org_admin(org_id));

-- pl_assignment_segments
DROP POLICY IF EXISTS "pl_assignment_segments_select" ON public.pl_assignment_segments;
CREATE POLICY "pl_assignment_segments_select" ON public.pl_assignment_segments FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_assignment_segments_insert" ON public.pl_assignment_segments;
CREATE POLICY "pl_assignment_segments_insert" ON public.pl_assignment_segments FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_assignment_segments_update" ON public.pl_assignment_segments;
CREATE POLICY "pl_assignment_segments_update" ON public.pl_assignment_segments FOR UPDATE
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_assignment_segments_delete" ON public.pl_assignment_segments;
CREATE POLICY "pl_assignment_segments_delete" ON public.pl_assignment_segments FOR DELETE
  USING (public.is_org_member(org_id));

-- pl_overtime_overrides
DROP POLICY IF EXISTS "pl_overtime_overrides_select" ON public.pl_overtime_overrides;
CREATE POLICY "pl_overtime_overrides_select" ON public.pl_overtime_overrides FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_overtime_overrides_insert" ON public.pl_overtime_overrides;
CREATE POLICY "pl_overtime_overrides_insert" ON public.pl_overtime_overrides FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_overtime_overrides_update" ON public.pl_overtime_overrides;
CREATE POLICY "pl_overtime_overrides_update" ON public.pl_overtime_overrides FOR UPDATE
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "pl_overtime_overrides_delete" ON public.pl_overtime_overrides;
CREATE POLICY "pl_overtime_overrides_delete" ON public.pl_overtime_overrides FOR DELETE
  USING (public.is_org_admin(org_id));

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_machines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_shift_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_crews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_crew_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_crew_rotation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_machine_demand TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_assignment_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_overtime_overrides TO authenticated;

-- Service role has full access
GRANT ALL ON public.pl_departments TO service_role;
GRANT ALL ON public.pl_lines TO service_role;
GRANT ALL ON public.pl_machines TO service_role;
GRANT ALL ON public.pl_employees TO service_role;
GRANT ALL ON public.pl_shift_templates TO service_role;
GRANT ALL ON public.pl_crews TO service_role;
GRANT ALL ON public.pl_crew_members TO service_role;
GRANT ALL ON public.pl_crew_rotation_rules TO service_role;
GRANT ALL ON public.pl_attendance TO service_role;
GRANT ALL ON public.pl_machine_demand TO service_role;
GRANT ALL ON public.pl_assignment_segments TO service_role;
GRANT ALL ON public.pl_overtime_overrides TO service_role;
