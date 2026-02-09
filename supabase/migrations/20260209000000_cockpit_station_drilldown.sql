-- v_cockpit_station_drilldown: person-level drilldown with shift_date for API filtering.
-- Strict+loose fallback: strict_match on employee_code=employee_anst_id; loose_match on
-- org_id+station_id+shift_type=shift_code only. UNION ALL strict + (loose minus strict).
--
-- Proof:
-- select shift_date, shift_code, station_code, count(*)
-- from public.v_cockpit_station_drilldown
-- where org_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   and site_id='2d3f16a8-dc34-4c66-8f7c-2481a84bffba'
--   and shift_date='2026-01-30'
-- group by 1,2,3
-- order by count(*) desc
-- limit 20;
CREATE OR REPLACE VIEW public.v_cockpit_station_drilldown
WITH (security_invoker = true)
AS
WITH strict_match AS (
  SELECT
    r.org_id,
    r.site_id,
    s.plan_date::date AS shift_date,
    r.shift_code,
    r.area,
    NULL::text AS leader_name,
    r.station_id,
    r.station_code,
    r.station_name,
    r.employee_anst_id,
    r.actual_level,
    3 AS required_level,
    r.status
  FROM public.v_roster_station_shift_drilldown_pilot r
  INNER JOIN public.pl_assignment_segments s
    ON s.org_id = r.org_id
   AND s.station_id = r.station_id
   AND s.shift_type::text = r.shift_code::text
   AND s.employee_code::text = r.employee_anst_id::text
  WHERE s.plan_date IS NOT NULL
),
loose_base AS (
  SELECT
    r.org_id,
    r.site_id,
    s.plan_date::date AS shift_date,
    r.shift_code,
    r.area,
    NULL::text AS leader_name,
    r.station_id,
    r.station_code,
    r.station_name,
    r.employee_anst_id,
    r.actual_level,
    3 AS required_level,
    r.status
  FROM public.v_roster_station_shift_drilldown_pilot r
  INNER JOIN public.pl_assignment_segments s
    ON s.org_id = r.org_id
   AND s.station_id = r.station_id
   AND s.shift_type::text = r.shift_code::text
  WHERE s.plan_date IS NOT NULL
),
loose_match AS (
  SELECT DISTINCT ON (org_id, site_id, station_id, shift_date, shift_code, employee_anst_id)
    org_id, site_id, shift_date, shift_code, area, leader_name, station_id, station_code, station_name,
    employee_anst_id, actual_level, required_level, status
  FROM loose_base
  ORDER BY org_id, site_id, station_id, shift_date, shift_code, employee_anst_id
)
SELECT * FROM strict_match
UNION ALL
SELECT l.* FROM loose_match l
WHERE NOT EXISTS (
  SELECT 1 FROM strict_match s
  WHERE s.org_id = l.org_id
    AND (s.site_id IS NOT DISTINCT FROM l.site_id)
    AND s.station_id = l.station_id
    AND s.shift_date = l.shift_date
    AND s.shift_code = l.shift_code
    AND s.employee_anst_id = l.employee_anst_id
);

COMMENT ON VIEW public.v_cockpit_station_drilldown IS 'Person-level drilldown with shift_date for Cockpit Issue Inbox; strict+loose fallback on employee match; filterable by org_id, site_id, shift_date, shift_code, station_id.';

GRANT SELECT ON public.v_cockpit_station_drilldown TO authenticated;
