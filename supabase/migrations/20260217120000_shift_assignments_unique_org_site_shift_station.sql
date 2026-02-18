-- Ensure conflict target for roster apply upsert is deterministic.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_assignments_org_site_shift_station
  ON public.shift_assignments(org_id, site_id, shift_id, station_id);
