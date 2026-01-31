-- Line Overview: canonical station_id for demand and assignments
-- Backfill from machine_code (match stations.code or stations.id).
-- New writes use station_id; machine_code kept for backward compatibility (display only).

-- 1) pl_machine_demand: add station_id
ALTER TABLE public.pl_machine_demand
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES public.stations(id) ON DELETE CASCADE;

-- 2) pl_assignment_segments: add station_id
ALTER TABLE public.pl_assignment_segments
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES public.stations(id) ON DELETE CASCADE;

-- 3) Backfill pl_machine_demand: match machine_code to stations.code or stations.id
UPDATE public.pl_machine_demand d
SET station_id = s.id
FROM public.stations s
WHERE d.org_id = s.org_id
  AND s.is_active = true
  AND d.station_id IS NULL
  AND (
    (s.code IS NOT NULL AND s.code = d.machine_code)
    OR (s.id::text = d.machine_code)
  );

-- 4) Backfill pl_assignment_segments: same
UPDATE public.pl_assignment_segments a
SET station_id = s.id
FROM public.stations s
WHERE a.org_id = s.org_id
  AND s.is_active = true
  AND a.station_id IS NULL
  AND (
    (s.code IS NOT NULL AND s.code = a.machine_code)
    OR (s.id::text = a.machine_code)
  );

-- 5) Make station_id NOT NULL for new rows (leave nullable for unbackfilled legacy rows)
-- So we don't break existing rows that couldn't be matched. New writes always set station_id.
-- Optional: uncomment to enforce NOT NULL after verifying backfill:
-- ALTER TABLE public.pl_machine_demand ALTER COLUMN station_id SET NOT NULL;
-- ALTER TABLE public.pl_assignment_segments ALTER COLUMN station_id SET NOT NULL;

-- 6) Index for lookups by station_id (unique on station/date/shift enforced in API)
CREATE INDEX IF NOT EXISTS idx_pl_machine_demand_station_id
  ON public.pl_machine_demand(org_id, plan_date, shift_type, station_id)
  WHERE station_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pl_assignment_segments_station_id
  ON public.pl_assignment_segments(org_id, plan_date, shift_type, station_id)
  WHERE station_id IS NOT NULL;

-- Verification: after backfill, check counts (run manually)
-- SELECT 'pl_machine_demand' AS tbl, COUNT(*) AS total, COUNT(station_id) AS with_station_id FROM public.pl_machine_demand
-- UNION ALL
-- SELECT 'pl_assignment_segments', COUNT(*), COUNT(station_id) FROM public.pl_assignment_segments;
