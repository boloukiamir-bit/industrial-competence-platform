-- P0: Data Contract Lockdown + Deterministic Shift Engine
-- 1) areas: add site_id, is_active. 2) shift_patterns table. 3) stations.area_id FK.
-- 4) shifts: add site_id, area_id, shift_code; UNIQUE(org_id, site_id, area_id, shift_date, shift_code). 5) RLS.

-- =============================================================================
-- 1) areas: add site_id (nullable), is_active
-- =============================================================================
ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill site_id from org's first site so deterministic seed can scope by site
UPDATE public.areas a
SET site_id = (
  SELECT s.id FROM public.sites s
  WHERE s.org_id = a.org_id
  ORDER BY s.created_at
  LIMIT 1
)
WHERE a.site_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_areas_site ON public.areas(site_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_areas_org_site_code
  ON public.areas(org_id, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

COMMENT ON COLUMN public.areas.site_id IS 'Optional site scope; null = org-wide. Seed uses site-scoped areas.';
COMMENT ON COLUMN public.areas.is_active IS 'Inactive areas are excluded from shift seed.';

-- =============================================================================
-- 2) shift_patterns (org_id, site_id, shift_code, start_time, end_time, break_minutes, is_active)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shift_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  shift_code text NOT NULL,
  start_time time,
  end_time time,
  break_minutes int NOT NULL DEFAULT 0 CHECK (break_minutes >= 0 AND break_minutes <= 480),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, shift_code)
);

CREATE INDEX IF NOT EXISTS idx_shift_patterns_site ON public.shift_patterns(site_id);
CREATE INDEX IF NOT EXISTS idx_shift_patterns_org ON public.shift_patterns(org_id);

ALTER TABLE public.shift_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_patterns_select" ON public.shift_patterns;
CREATE POLICY "shift_patterns_select" ON public.shift_patterns
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "shift_patterns_insert" ON public.shift_patterns;
CREATE POLICY "shift_patterns_insert" ON public.shift_patterns
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "shift_patterns_update" ON public.shift_patterns;
CREATE POLICY "shift_patterns_update" ON public.shift_patterns
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "shift_patterns_delete" ON public.shift_patterns;
CREATE POLICY "shift_patterns_delete" ON public.shift_patterns
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

COMMENT ON TABLE public.shift_patterns IS 'Deterministic shift definitions per site (shift_code + time window). Used by POST /api/shifts/seed.';

-- Optional: copy from shift_codes into shift_patterns (idempotent by UNIQUE)
INSERT INTO public.shift_patterns (org_id, site_id, shift_code, start_time, end_time, break_minutes, is_active)
SELECT s.org_id, sc.site_id, sc.code, sc.start_time, sc.end_time, sc.break_minutes, true
FROM public.shift_codes sc
JOIN public.sites s ON s.id = sc.site_id
ON CONFLICT (site_id, shift_code) DO NOTHING;

-- =============================================================================
-- 3) stations: add area_id FK
-- =============================================================================
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Backfill area_id from area_code (same org, code match)
UPDATE public.stations st
SET area_id = (
  SELECT a.id FROM public.areas a
  WHERE a.org_id = st.org_id AND a.code = st.area_code
  LIMIT 1
)
WHERE st.area_code IS NOT NULL AND st.area_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_stations_area ON public.stations(area_id);

COMMENT ON COLUMN public.stations.area_id IS 'FK to areas; preferred over line/area_code for deterministic seed.';

-- =============================================================================
-- 4) shifts: add site_id, area_id, shift_code; UNIQUE for deterministic seed
-- =============================================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_code text;

-- Backfill shift_code from shift_type (Day/Evening/Night)
UPDATE public.shifts
SET shift_code = shift_type
WHERE shift_type IS NOT NULL AND (shift_code IS NULL OR shift_code = '');

-- Backfill area_id from line via areas (match by org + code; use area_code from stations or line as code)
UPDATE public.shifts sh
SET area_id = (
  SELECT a.id FROM public.areas a
  WHERE a.org_id = sh.org_id
    AND (a.code = sh.line OR a.name = sh.line)
  LIMIT 1
)
WHERE sh.line IS NOT NULL AND sh.area_id IS NULL;

-- Backfill site_id from org's first site where missing
UPDATE public.shifts sh
SET site_id = (
  SELECT s.id FROM public.sites s WHERE s.org_id = sh.org_id ORDER BY s.created_at LIMIT 1
)
WHERE sh.site_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_site ON public.shifts(site_id);
CREATE INDEX IF NOT EXISTS idx_shifts_area ON public.shifts(area_id);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_code ON public.shifts(shift_code);

-- Deterministic seed key: one shift per (org, site, area, date, shift_code)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_org_site_area_date_shift_code
  ON public.shifts(org_id, site_id, area_id, shift_date, shift_code)
  WHERE site_id IS NOT NULL AND area_id IS NOT NULL AND shift_date IS NOT NULL AND shift_code IS NOT NULL;

COMMENT ON COLUMN public.shifts.shift_code IS 'From shift_patterns; e.g. S1, Day. Replaces reliance on shift_type for seed.';
COMMENT ON COLUMN public.shifts.area_id IS 'FK to areas; replaces free-text line for deterministic seed.';

-- RLS: shifts already have org-based policy; ensure new columns are covered (no change needed)
-- shift_assignments: already org-scoped; no schema change
