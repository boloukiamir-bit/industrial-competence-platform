-- Seed Factory: areas (business areas) and shift_codes (per site).
-- Idempotent upsert by (org_id, code) for areas, (site_id, code) for shift_codes.
-- RLS: is_org_member read; is_org_admin_or_hr write. Reuses existing helpers.

-- =============================================================================
-- 1) public.areas — business areas per org (e.g. Bearbetning, Ommantling, Packen)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_areas_org ON public.areas(org_id);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_select" ON public.areas;
CREATE POLICY "areas_select" ON public.areas
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "areas_insert" ON public.areas;
CREATE POLICY "areas_insert" ON public.areas
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "areas_update" ON public.areas;
CREATE POLICY "areas_update" ON public.areas
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "areas_delete" ON public.areas;
CREATE POLICY "areas_delete" ON public.areas
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

COMMENT ON TABLE public.areas IS 'Business areas per org for factory structure seed (e.g. Bearbetning, Ommantling).';

-- =============================================================================
-- 2) public.shift_codes — shift definitions per site (S1, S2, S3 + time windows)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  start_time time,
  end_time time,
  break_minutes int NOT NULL DEFAULT 0 CHECK (break_minutes >= 0 AND break_minutes <= 480),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shift_codes_site ON public.shift_codes(site_id);

ALTER TABLE public.shift_codes ENABLE ROW LEVEL SECURITY;

-- Policy: read/write via site's org (is_org_admin_or_hr(org_id) where org_id from sites)
DROP POLICY IF EXISTS "shift_codes_select" ON public.shift_codes;
CREATE POLICY "shift_codes_select" ON public.shift_codes
  FOR SELECT USING (
    public.is_org_member((SELECT org_id FROM public.sites WHERE id = shift_codes.site_id))
  );

DROP POLICY IF EXISTS "shift_codes_insert" ON public.shift_codes;
CREATE POLICY "shift_codes_insert" ON public.shift_codes
  FOR INSERT WITH CHECK (
    public.is_org_admin_or_hr((SELECT org_id FROM public.sites WHERE id = shift_codes.site_id))
  );

DROP POLICY IF EXISTS "shift_codes_update" ON public.shift_codes;
CREATE POLICY "shift_codes_update" ON public.shift_codes
  FOR UPDATE USING (
    public.is_org_admin_or_hr((SELECT org_id FROM public.sites WHERE id = shift_codes.site_id))
  );

DROP POLICY IF EXISTS "shift_codes_delete" ON public.shift_codes;
CREATE POLICY "shift_codes_delete" ON public.shift_codes
  FOR DELETE USING (
    public.is_org_admin_or_hr((SELECT org_id FROM public.sites WHERE id = shift_codes.site_id))
  );

COMMENT ON TABLE public.shift_codes IS 'Shift codes per site (e.g. S1, S2, S3) with optional time windows and break minutes.';
