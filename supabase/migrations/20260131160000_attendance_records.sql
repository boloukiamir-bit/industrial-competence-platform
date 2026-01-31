-- attendance_records: per org/date/shift/employee attendance (affects suggestions/coverage)
-- Replaces pl_attendance as canonical source; uses employee_id for FK integrity.

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  work_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present','partial','absent')),
  minutes_present int,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, work_date, shift_type, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_org_date
  ON public.attendance_records(org_id, work_date, shift_type);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee
  ON public.attendance_records(employee_id);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Helper: admin or hr can write
CREATE OR REPLACE FUNCTION public.is_org_admin_or_hr(check_org_id uuid)
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

GRANT EXECUTE ON FUNCTION public.is_org_admin_or_hr(uuid) TO authenticated;

-- RLS: org-scoped read for authenticated members; admin/hr can write
DROP POLICY IF EXISTS "attendance_records_select" ON public.attendance_records;
CREATE POLICY "attendance_records_select" ON public.attendance_records
  FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "attendance_records_insert" ON public.attendance_records;
CREATE POLICY "attendance_records_insert" ON public.attendance_records
  FOR INSERT
  WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "attendance_records_update" ON public.attendance_records;
CREATE POLICY "attendance_records_update" ON public.attendance_records
  FOR UPDATE
  USING (public.is_org_admin_or_hr(org_id))
  WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "attendance_records_delete" ON public.attendance_records;
CREATE POLICY "attendance_records_delete" ON public.attendance_records
  FOR DELETE
  USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
