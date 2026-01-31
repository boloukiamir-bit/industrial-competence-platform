-- Unique index for demand upsert by (org_id, plan_date, shift_type, station_id).
-- Enables ON CONFLICT DO UPDATE when generating demo demand per station.
-- Partial index: only rows with station_id set (canonical demand rows).

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pl_machine_demand_org_date_shift_station
  ON public.pl_machine_demand (org_id, plan_date, shift_type, station_id)
  WHERE station_id IS NOT NULL;
