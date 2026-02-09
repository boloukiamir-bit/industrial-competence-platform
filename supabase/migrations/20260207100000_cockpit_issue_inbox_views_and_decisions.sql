-- Cockpit Issue Inbox: views and execution_decisions support for station_shift decisions.
-- 1) Extend execution_decisions for station_issue / station_shift.
-- 2) v_roster_station_shift_drilldown_pilot: person-level gaps per station+shift.
-- 3) v_cockpit_station_summary: station-level aggregates (NO_GO/WARNING/GO counts).

-- =============================================================================
-- 1) execution_decisions: add station_issue / station_shift
-- =============================================================================
-- Drop inline CHECK constraints (Postgres auto-names them) and add expanded ones.
DO $$
BEGIN
  -- decision_type: add station_issue
  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_decision_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_decision_type_check
    CHECK (decision_type IN (
      'resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate',
      'station_issue', 'acknowledged_station_issue', 'plan_training'
    ));

  -- target_type: add station_shift
  ALTER TABLE public.execution_decisions
    DROP CONSTRAINT IF EXISTS execution_decisions_target_type_check;
  ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_target_type_check
    CHECK (target_type IN (
      'line_shift', 'assignment', 'employee', 'shift_assignment', 'station_shift'
    ));
EXCEPTION
  WHEN undefined_object THEN NULL; -- constraint names may vary
END $$;

-- Relax root_cause constraint for station_issue (root_cause.type can be 'station_issue')
-- The existing execution_decisions_active_requires_root_cause_type enforces root_cause->>'type' IS NOT NULL.
-- We will store root_cause with type='station_issue' so it satisfies the constraint.

-- =============================================================================
-- 2) v_roster_station_shift_drilldown_pilot: person-level gaps per station+shift
-- =============================================================================
-- Roster = pl_assignment_segments (plan_date, shift_type, station_id, employee_code).
-- Coverage = v_station_coverage_status (org, site, station, employee_anst_id, status, actual_level).
-- employee_code in roster maps to employee_anst_id in coverage.
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
  JOIN public.stations st ON st.id = a.station_id AND st.org_id = a.org_id AND st.is_active = true
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

COMMENT ON VIEW public.v_roster_station_shift_drilldown_pilot IS 'Person-level competence gaps per station+shift; for Cockpit Issue Inbox drilldown.';

GRANT SELECT ON public.v_roster_station_shift_drilldown_pilot TO authenticated;

-- =============================================================================
-- 3) v_cockpit_station_summary: station-level aggregates
-- =============================================================================
-- Aggregates drilldown by (org_id, site_id, plan_date, shift_code, station_id).
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
    plan_date,
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
  GROUP BY org_id, site_id, plan_date, shift_code, station_id
)
SELECT
  agg.org_id,
  agg.site_id,
  agg.plan_date,
  agg.shift_code,
  agg.station_id,
  agg.station_code,
  agg.station_name,
  agg.area,
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
  END AS severity_rank,
  NULL::text AS leader_name
FROM agg;

COMMENT ON VIEW public.v_cockpit_station_summary IS 'Station-level competence summary per shift; for Cockpit Issue Inbox list.';

GRANT SELECT ON public.v_cockpit_station_summary TO authenticated;
