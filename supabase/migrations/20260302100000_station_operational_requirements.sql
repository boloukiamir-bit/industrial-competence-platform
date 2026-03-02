-- Pilot: station_operational_requirements for headcount/skill level per station (by station_code).
-- UPSERT key: (org_id, station_code). No FK to stations to allow import before or with stations.

CREATE TABLE IF NOT EXISTS public.station_operational_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  station_code text NOT NULL,
  required_headcount numeric NULL,
  required_skill_level int NOT NULL DEFAULT 2 CHECK (required_skill_level BETWEEN 0 AND 5),
  required_senior_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, station_code)
);

CREATE INDEX IF NOT EXISTS idx_station_operational_requirements_org
  ON public.station_operational_requirements(org_id);

COMMENT ON TABLE public.station_operational_requirements IS 'Pilot: required headcount and skill level per station (by code). Idempotent import key: org_id + station_code.';

ALTER TABLE public.station_operational_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "station_operational_requirements_select" ON public.station_operational_requirements;
CREATE POLICY "station_operational_requirements_select" ON public.station_operational_requirements
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "station_operational_requirements_insert" ON public.station_operational_requirements;
CREATE POLICY "station_operational_requirements_insert" ON public.station_operational_requirements
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "station_operational_requirements_update" ON public.station_operational_requirements;
CREATE POLICY "station_operational_requirements_update" ON public.station_operational_requirements
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "station_operational_requirements_delete" ON public.station_operational_requirements;
CREATE POLICY "station_operational_requirements_delete" ON public.station_operational_requirements
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));
