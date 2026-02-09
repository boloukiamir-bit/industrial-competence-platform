-- Competence & gap model: GO/WARNING/NO-GO logic, RLS-ready tables, reusable station coverage view.
-- Tenant-safe (org_id/site_id). No demo data. No legacy fields. Fail fast.
-- 1) Ensure sites exists for FK (minimal; may be populated from org_units elsewhere).
-- 2) station_skill_requirements as table (drop view if exists). 3) employee_skill_ratings if not exists.
-- 4) RLS + policies (is_org_member read, is_org_admin_or_hr write). 5) fn_skill_status + v_station_coverage_status.

-- =============================================================================
-- 1) Sites table (minimal) for station_skill_requirements.site_id FK
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sites_org ON public.sites(org_id);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sites_select" ON public.sites;
CREATE POLICY "sites_select" ON public.sites
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "sites_insert" ON public.sites;
CREATE POLICY "sites_insert" ON public.sites
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "sites_update" ON public.sites;
CREATE POLICY "sites_update" ON public.sites
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "sites_delete" ON public.sites;
CREATE POLICY "sites_delete" ON public.sites
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

COMMENT ON TABLE public.sites IS 'Sites per org; used for tenant-scoped station requirements. Can be backfilled from org_units where type=site.';

-- =============================================================================
-- 2) station_skill_requirements: table (replace view if present)
-- =============================================================================
DROP VIEW IF EXISTS public.station_skill_requirements;

CREATE TABLE IF NOT EXISTS public.station_skill_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  skill_code text NOT NULL,
  required_level int NOT NULL CHECK (required_level BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, site_id, station_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_station_skill_requirements_org_site
  ON public.station_skill_requirements(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_station_skill_requirements_station
  ON public.station_skill_requirements(station_id);

ALTER TABLE public.station_skill_requirements ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3) employee_skill_ratings: per-station per-skill per-employee (Excel 1-to-1)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_skill_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  employee_anst_id text NOT NULL,
  skill_code text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 0 AND 5),
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, site_id, station_id, employee_anst_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_employee_skill_ratings_org_site_station
  ON public.employee_skill_ratings(org_id, site_id, station_id);
CREATE INDEX IF NOT EXISTS idx_employee_skill_ratings_valid_to
  ON public.employee_skill_ratings(org_id, site_id, station_id, skill_code)
  WHERE valid_to IS NULL OR valid_to >= current_date;

ALTER TABLE public.employee_skill_ratings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4) RLS policies: read = is_org_member, write = is_org_admin_or_hr
-- =============================================================================
-- station_skill_requirements
DROP POLICY IF EXISTS "station_skill_requirements_select" ON public.station_skill_requirements;
CREATE POLICY "station_skill_requirements_select" ON public.station_skill_requirements
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "station_skill_requirements_insert" ON public.station_skill_requirements;
CREATE POLICY "station_skill_requirements_insert" ON public.station_skill_requirements
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "station_skill_requirements_update" ON public.station_skill_requirements;
CREATE POLICY "station_skill_requirements_update" ON public.station_skill_requirements
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "station_skill_requirements_delete" ON public.station_skill_requirements;
CREATE POLICY "station_skill_requirements_delete" ON public.station_skill_requirements
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- employee_skill_ratings
DROP POLICY IF EXISTS "employee_skill_ratings_select" ON public.employee_skill_ratings;
CREATE POLICY "employee_skill_ratings_select" ON public.employee_skill_ratings
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_skill_ratings_insert" ON public.employee_skill_ratings;
CREATE POLICY "employee_skill_ratings_insert" ON public.employee_skill_ratings
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_skill_ratings_update" ON public.employee_skill_ratings;
CREATE POLICY "employee_skill_ratings_update" ON public.employee_skill_ratings
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_skill_ratings_delete" ON public.employee_skill_ratings;
CREATE POLICY "employee_skill_ratings_delete" ON public.employee_skill_ratings
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- =============================================================================
-- 5) Canonical status function (GO / WARNING / NO-GO)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_skill_status(
  required_level int,
  actual_level int
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN actual_level IS NULL THEN 'NO_GO'
    WHEN actual_level = 0 THEN 'NO_GO'
    WHEN actual_level BETWEEN 1 AND 2 THEN 'WARNING'
    ELSE 'GO'
  END
$$;

COMMENT ON FUNCTION public.fn_skill_status(int, int) IS 'Canonical competence status: GO (3-5), WARNING (1-2), NO_GO (null/0).';

-- =============================================================================
-- 6) Station coverage view (system backbone; Cockpit, Tomorrow''s Gaps, Suggestions)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_station_coverage_status
WITH (security_invoker = true)
AS
SELECT
  ssr.org_id,
  ssr.site_id,
  ssr.station_id,
  esr.employee_anst_id,
  ssr.skill_code,
  ssr.required_level,
  esr.level AS actual_level,
  public.fn_skill_status(ssr.required_level, esr.level) AS status
FROM public.station_skill_requirements ssr
LEFT JOIN public.employee_skill_ratings esr
  ON esr.org_id = ssr.org_id
  AND esr.site_id = ssr.site_id
  AND esr.station_id = ssr.station_id
  AND esr.skill_code = ssr.skill_code
  AND (esr.valid_to IS NULL OR esr.valid_to >= current_date);

COMMENT ON VIEW public.v_station_coverage_status IS 'Per-station coverage: requirement + optional rating; status GO/WARNING/NO_GO. Reused by Cockpit, Tomorrows Gaps, Suggestions.';

-- Grant (view uses security_invoker so RLS on ssr/esr applies)
GRANT SELECT ON public.v_station_coverage_status TO authenticated;

-- Sanity check (run manually after migration; must return rows when data exists):
--   SELECT status, count(*) FROM public.v_station_coverage_status GROUP BY status;
