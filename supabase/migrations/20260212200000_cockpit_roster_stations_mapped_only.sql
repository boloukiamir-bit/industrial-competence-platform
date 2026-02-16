-- Cockpit: only include stations with area_id set (mapped, active masterdata).
-- Recreate v_roster_station_shift_drilldown_pilot so unmapped stations never appear in cockpit.
CREATE OR REPLACE VIEW public.v_roster_station_shift_drilldown_pilot
WITH (security_invoker = true)
AS
WITH roster AS (
  SELECT
    a.org_id,
    ssr.site_id,
    a.plan_date,
    a.shift_type AS shift_code,
    st.id AS station_id,
    st.code AS station_code,
    st.name AS station_name,
    COALESCE(st.area_code, st.area, st.line) AS area,
    a.employee_code AS employee_anst_id
  FROM public.pl_assignment_segments a
  JOIN public.stations st ON st.id = a.station_id AND st.org_id = a.org_id AND st.is_active = true AND st.area_id IS NOT NULL
  JOIN public.station_skill_requirements ssr
    ON ssr.station_id = st.id AND ssr.org_id = a.org_id
  WHERE a.employee_code IS NOT NULL AND a.employee_code <> ''
),
person_status AS (
  SELECT
    v.org_id,
    v.site_id,
    v.station_id,
    v.employee_anst_id,
    MIN(v.actual_level) AS actual_level,
    MIN(CASE v.status WHEN 'NO_GO' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END) AS status_rank
  FROM public.v_station_coverage_status v
  GROUP BY v.org_id, v.site_id, v.station_id, v.employee_anst_id
)
SELECT
  r.org_id,
  r.site_id,
  r.plan_date,
  r.shift_code,
  r.station_id,
  r.station_code,
  r.station_name,
  r.area,
  r.employee_anst_id,
  ps.actual_level,
  CASE COALESCE(ps.status_rank, 1)
    WHEN 1 THEN 'NO_GO'
    WHEN 2 THEN 'WARNING'
    ELSE 'GO'
  END AS status
FROM roster r
LEFT JOIN person_status ps
  ON ps.org_id = r.org_id AND ps.site_id = r.site_id
  AND ps.station_id = r.station_id AND ps.employee_anst_id = r.employee_anst_id;

COMMENT ON VIEW public.v_roster_station_shift_drilldown_pilot IS 'Person-level competence gaps per station+shift; only stations with is_active and area_id not null (mapped).';
