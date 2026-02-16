-- P0: Cockpit Station Health must not show GREEN when a station has zero assigned employees.
-- Postgres-safe: cannot reorder/rename columns with CREATE OR REPLACE VIEW.
-- 1) New view v_cockpit_station_summary_v2 with new logic (assigned_employees_count, is_unstaffed, UNSTAFFED status).
-- 2) Replace v_cockpit_station_summary with a wrapper SELECT from v2 that preserves original column order and appends new columns at end.

-- =============================================================================
-- 1) v_cockpit_station_summary_v2: full logic, any column order
-- =============================================================================
CREATE OR REPLACE VIEW public.v_cockpit_station_summary_v2
WITH (security_invoker = true)
AS
WITH
sa_agg AS (
  SELECT
    sa.org_id,
    sh.site_id,
    to_char(sh.shift_date::date, 'YYYY-MM-DD') AS shift_date,
    sh.shift_code,
    sa.station_id,
    COUNT(sa.employee_id)::int AS assigned_employees_count
  FROM public.shift_assignments sa
  JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = sa.org_id
  JOIN public.stations st ON st.id = sa.station_id AND st.org_id = sa.org_id
    AND st.is_active = true
  WHERE sh.shift_date IS NOT NULL AND sh.shift_code IS NOT NULL
  GROUP BY sa.org_id, sh.site_id, sh.shift_date, sh.shift_code, sa.station_id
),
roster_drill AS (
  SELECT
    a.org_id,
    ssr.site_id,
    a.plan_date,
    a.shift_type AS shift_code,
    st.id AS station_id,
    st.code AS station_code,
    st.name AS station_name,
    COALESCE(st.area_code, st.line) AS area,
    a.employee_code AS employee_anst_id,
    CASE COALESCE(ps.status_rank, 1)
      WHEN 1 THEN 'NO_GO'
      WHEN 2 THEN 'WARNING'
      ELSE 'GO'
    END AS status
  FROM public.pl_assignment_segments a
  JOIN public.stations st ON st.id = a.station_id AND st.org_id = a.org_id AND st.is_active = true
  JOIN public.station_skill_requirements ssr ON ssr.station_id = st.id AND ssr.org_id = a.org_id
  LEFT JOIN (
    SELECT
      v.org_id,
      v.site_id,
      v.station_id,
      v.employee_anst_id,
      MIN(CASE v.status WHEN 'NO_GO' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END) AS status_rank
    FROM public.v_station_coverage_status v
    GROUP BY v.org_id, v.site_id, v.station_id, v.employee_anst_id
  ) ps ON ps.org_id = a.org_id AND ps.site_id = ssr.site_id
    AND ps.station_id = st.id AND ps.employee_anst_id = a.employee_code
  WHERE a.employee_code IS NOT NULL AND a.employee_code <> ''
    AND a.plan_date IS NOT NULL
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
  FROM roster_drill
  GROUP BY org_id, site_id, plan_date::date, shift_code, station_id
),
st_meta AS (
  SELECT
    st.id AS station_id,
    st.org_id,
    st.code AS station_code,
    st.name AS station_name,
    COALESCE(a.name, st.area_code, st.line) AS area
  FROM public.stations st
  LEFT JOIN public.areas a ON a.id = st.area_id AND a.org_id = st.org_id
  WHERE st.is_active = true
)
SELECT
  sa_agg.org_id,
  sa_agg.site_id,
  sa_agg.shift_date,
  COALESCE(agg.area, sm.area) AS area,
  sa_agg.shift_code,
  NULL::text AS leader_name,
  sa_agg.station_id,
  COALESCE(agg.station_code, sm.station_code) AS station_code,
  COALESCE(agg.station_name, sm.station_name) AS station_name,
  CASE
    WHEN sa_agg.assigned_employees_count IS NULL OR sa_agg.assigned_employees_count = 0 THEN 0
    ELSE COALESCE(agg.no_go_count, 0)
  END AS no_go_count,
  CASE
    WHEN sa_agg.assigned_employees_count IS NULL OR sa_agg.assigned_employees_count = 0 THEN 0
    ELSE COALESCE(agg.warning_count, 0)
  END AS warning_count,
  CASE
    WHEN sa_agg.assigned_employees_count IS NULL OR sa_agg.assigned_employees_count = 0 THEN 0
    ELSE COALESCE(agg.go_count, 0)
  END AS go_count,
  CASE
    WHEN sa_agg.assigned_employees_count IS NULL OR sa_agg.assigned_employees_count = 0 THEN 0
    ELSE COALESCE(agg.roster_headcount, 0)
  END AS roster_headcount,
  CASE
    WHEN sa_agg.assigned_employees_count IS NULL OR sa_agg.assigned_employees_count = 0 THEN 'UNSTAFFED'
    WHEN sa_agg.assigned_employees_count > 0 AND COALESCE(agg.no_go_count, 0) > 0 THEN 'NO_GO'
    WHEN sa_agg.assigned_employees_count > 0 AND COALESCE(agg.warning_count, 0) > 0 THEN 'WARNING'
    ELSE 'GO'
  END AS station_shift_status,
  CASE
    WHEN sa_agg.assigned_employees_count IS NULL OR sa_agg.assigned_employees_count = 0 THEN 1
    WHEN COALESCE(agg.no_go_count, 0) > 0 THEN 1
    WHEN COALESCE(agg.warning_count, 0) > 0 THEN 2
    ELSE 3
  END AS severity_rank,
  sa_agg.assigned_employees_count,
  (sa_agg.assigned_employees_count = 0) AS is_unstaffed
FROM sa_agg
LEFT JOIN agg
  ON agg.org_id = sa_agg.org_id
  AND agg.site_id IS NOT DISTINCT FROM sa_agg.site_id
  AND agg.shift_date = sa_agg.shift_date
  AND agg.shift_code = sa_agg.shift_code
  AND agg.station_id = sa_agg.station_id
LEFT JOIN st_meta sm ON sm.station_id = sa_agg.station_id AND sm.org_id = sa_agg.org_id;

COMMENT ON VIEW public.v_cockpit_station_summary_v2 IS 'Station-level summary per shift (source); assigned_employees_count, is_unstaffed, UNSTAFFED status.';

GRANT SELECT ON public.v_cockpit_station_summary_v2 TO authenticated;

-- =============================================================================
-- 2) v_cockpit_station_summary: wrapper preserving original column order, new columns at end
-- =============================================================================
DROP VIEW IF EXISTS public.v_cockpit_station_summary;

CREATE VIEW public.v_cockpit_station_summary
WITH (security_invoker = true)
AS
SELECT
  org_id,
  site_id,
  shift_date,
  area,
  shift_code,
  leader_name,
  station_id,
  station_code,
  station_name,
  no_go_count,
  warning_count,
  go_count,
  roster_headcount,
  station_shift_status,
  severity_rank,
  assigned_employees_count,
  is_unstaffed
FROM public.v_cockpit_station_summary_v2;

COMMENT ON VIEW public.v_cockpit_station_summary IS 'Station-level summary per shift; wrapper over v2 preserving original column order; assigned_employees_count and is_unstaffed at end.';

GRANT SELECT ON public.v_cockpit_station_summary TO authenticated;

-- =============================================================================
-- Verify: for org_id and shift_date/shift_code, UNSTAFFED count = 22 (roster stations)
-- =============================================================================
-- SELECT COUNT(*) AS unstaffed_count
-- FROM public.v_cockpit_station_summary
-- WHERE org_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   AND shift_date = '2026-01-30'
--   AND shift_code = 'Day'
--   AND station_shift_status = 'UNSTAFFED';
-- Expected: unstaffed_count = 22
