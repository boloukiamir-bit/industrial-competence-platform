-- P0.23: stations.line MUST store LINE CODE (BEA/OMM/PAC/LOG/UND), not Swedish name.
-- 1) Add area_code to stations; 2) Unique (org_id, area_code, code) for upsert; 3) One-off normalize Spaljisten.

-- 1) Add area_code if not present
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS area_code text;

-- 2) Unique constraint for tenant-scoped upsert by (org_id, area_code, code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stations'::regclass
      AND conname = 'stations_org_id_area_code_code_key'
  ) THEN
    ALTER TABLE public.stations
      ADD CONSTRAINT stations_org_id_area_code_code_key UNIQUE (org_id, area_code, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stations_org_area_code ON public.stations(org_id, area_code);

-- 3) One-off: set stations.line = stations.area_code for Spaljisten where area_code is set and line differs (do not guess)
UPDATE public.stations
SET line = area_code,
    updated_at = now()
WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
  AND area_code IS NOT NULL
  AND (line IS NULL OR line IS DISTINCT FROM area_code);
