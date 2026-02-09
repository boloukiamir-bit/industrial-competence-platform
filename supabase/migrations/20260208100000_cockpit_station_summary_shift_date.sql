-- v_cockpit_station_summary: add shift_date column for date filtering.
-- Source: plan_date from pl_assignment_segments (via v_roster_station_shift_drilldown_pilot).
-- Filterable by: org_id, site_id, shift_date, shift_code, optional area.
CREATE OR REPLACE VIEW public.v_cockpit_station_summary
WITH (security_invoker = true)
AS
WITH drill AS (
  SELECT
    org_id,
    site_id,
    plan_date,
    shift_code,
    station_id,
    station_code,
    station_name,
    area,
    employee_anst_id,
    status,
    actual_level
  FROM public.v_roster_station_shift_drilldown_pilot
),
agg AS (
  SELECT
    org_id,
    site_id,
    to_char(MIN(plan_date)::date, 'YYYY-MM-DD') AS shift_date,
    shift_code,
    station_id,
    MAX(station_code) AS station_code,
    MAX(station_name) AS station_name,
    MAX(area) AS area,
    COUNT(*) FILTER (WHERE status = 'NO_GO') AS no_go_count,
    COUNT(*) FILTER (WHERE status = 'WARNING') AS warning_count,
    COUNT(*) FILTER (WHERE status = 'GO') AS go_count,
    COUNT(*) AS roster_headcount
  FROM drill
  WHERE plan_date IS NOT NULL
  GROUP BY org_id, site_id, plan_date::date, shift_code, station_id
)
SELECT
  agg.org_id,
  agg.site_id,
  agg.shift_date,
  agg.area,
  agg.shift_code,
  NULL::text AS leader_name,
  agg.station_id,
  agg.station_code,
  agg.station_name,
  agg.no_go_count,
  agg.warning_count,
  agg.go_count,
  agg.roster_headcount,
  CASE
    WHEN agg.no_go_count > 0 THEN 'NO_GO'
    WHEN agg.warning_count > 0 THEN 'WARNING'
    ELSE 'GO'
  END AS station_shift_status,
  CASE
    WHEN agg.no_go_count > 0 THEN 1
    WHEN agg.warning_count > 0 THEN 2
    ELSE 3
  END AS severity_rank
FROM agg;

COMMENT ON VIEW public.v_cockpit_station_summary IS 'Station-level competence summary per shift; shift_date from roster.plan_date for date filtering.';

GRANT SELECT ON public.v_cockpit_station_summary TO authenticated;

-- Proof: SELECT * FROM public.v_cockpit_station_summary
--   WHERE org_id = $1 AND (site_id = $2 OR ($2 IS NULL AND site_id IS NULL))
--   AND shift_date = '2026-02-07' AND shift_code = 'Day';
