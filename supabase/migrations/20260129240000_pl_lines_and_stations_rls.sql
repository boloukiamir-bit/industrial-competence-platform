-- P0.18: Master data for lines (areas) and area leaders. RLS: stations editable by admin/hr only.

-- pl_lines: line_code, line_name, optional leader, is_active (tenant-scoped by org_id)
CREATE TABLE IF NOT EXISTS public.pl_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_code text NOT NULL,
  line_name text NOT NULL DEFAULT '',
  leader_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, line_code)
);

-- If pl_lines already existed (e.g. from sql/007) without these columns, add them
ALTER TABLE public.pl_lines
  ADD COLUMN IF NOT EXISTS leader_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.pl_lines
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_pl_lines_org ON public.pl_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_pl_lines_leader ON public.pl_lines(leader_employee_id);

ALTER TABLE public.pl_lines ENABLE ROW LEVEL SECURITY;

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

-- Stations: keep SELECT for org members, restrict INSERT/UPDATE/DELETE to admin/hr
-- (stations table created in sql/006_cockpit_tables; policy name from there)
DROP POLICY IF EXISTS "stations_org_access" ON public.stations;

DROP POLICY IF EXISTS "stations_select" ON public.stations;
CREATE POLICY "stations_select" ON public.stations FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "stations_insert" ON public.stations;
CREATE POLICY "stations_insert" ON public.stations FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "stations_update" ON public.stations;
CREATE POLICY "stations_update" ON public.stations FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "stations_delete" ON public.stations;
CREATE POLICY "stations_delete" ON public.stations FOR DELETE
  USING (public.is_org_admin(org_id));
