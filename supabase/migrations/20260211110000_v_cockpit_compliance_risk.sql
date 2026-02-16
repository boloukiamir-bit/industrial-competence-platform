-- v_cockpit_compliance_risk_station_shift: aggregate compliance risk per (org_id, site_id, station_id, shift_code).
-- Replicates rules from lib/compliance/rules.ts: missing=20, expired=12, expiring_7=6, expiring_30=3.
-- Used by /api/cockpit/summary for single-query total_compliance_risk_points.
-- Pilot: required codes from requiredComplianceForContext (shift-based NIGHT_EXAM; no customer_code).

CREATE OR REPLACE VIEW public.v_cockpit_compliance_risk_station_shift
WITH (security_invoker = true)
AS
WITH roster_distinct AS (
  -- Distinct (org, site, station, shift, employee_id) from roster. No date filter (matches getRosterEmployeeIdsForStationShift).
  SELECT DISTINCT
    r.org_id,
    r.site_id,
    r.station_id,
    r.shift_code,
    e.id AS employee_id
  FROM public.v_roster_station_shift_drilldown_pilot r
  JOIN public.employees e
    ON e.org_id = r.org_id
    AND e.employee_number::text = r.employee_anst_id::text
  WHERE r.employee_anst_id IS NOT NULL AND r.employee_anst_id <> ''
),

-- Required catalog per (org_id, shift_code): base codes + NIGHT_EXAM only when Night.
-- Base: WORK_ENVIRONMENT + SUSTAINABILITY + MEDICAL_CONTROL (excl NIGHT_EXAM) + MEDICAL_TRAINING.
required_catalog AS (
  SELECT cc.org_id, cc.id AS compliance_id, cc.code
  FROM public.compliance_catalog cc
  WHERE cc.is_active = true
    AND cc.code IN (
      'BAM_GRUND', 'BAM_FORTS', 'FIRE_SAFETY', 'FIRST_AID', 'CPR',
      'FSC',
      'EPOXY_EXAM', 'HAND_INTENSIVE_EXAM', 'HEARING_TEST', 'VISION_TEST', 'GENERAL_HEALTH',
      'EPOXY_TRAINING'
    )
  UNION ALL
  SELECT cc.org_id, cc.id AS compliance_id, cc.code
  FROM public.compliance_catalog cc
  WHERE cc.is_active = true
    AND cc.code = 'NIGHT_EXAM'
),

-- All roster rows with their required catalog (NIGHT_EXAM only when shift is Night).
roster_required AS (
  SELECT
    rd.org_id,
    rd.site_id,
    rd.station_id,
    rd.shift_code,
    rd.employee_id,
    rc.compliance_id
  FROM roster_distinct rd
  JOIN required_catalog rc ON rc.org_id = rd.org_id
  WHERE rc.code <> 'NIGHT_EXAM'
  UNION ALL
  SELECT
    rd.org_id,
    rd.site_id,
    rd.station_id,
    rd.shift_code,
    rd.employee_id,
    rc.compliance_id
  FROM roster_distinct rd
  JOIN required_catalog rc ON rc.org_id = rd.org_id AND rc.code = 'NIGHT_EXAM'
  WHERE lower(trim(rd.shift_code)) IN ('night', '3', 'fm')
),

-- Per (employee, compliance_id): status bucket and risk points.
-- waived -> valid (0); valid_to null -> missing (20); valid_to < today -> expired (12);
-- days_left <= 7 -> expiring_7 (6); days_left <= 30 -> expiring_30 (3).
per_item AS (
  SELECT
    rr.org_id,
    rr.site_id,
    rr.station_id,
    rr.shift_code,
    rr.employee_id,
    rr.compliance_id,
    CASE
      WHEN COALESCE(ec.waived, false) THEN 'valid'
      WHEN ec.valid_to IS NULL THEN 'missing'
      WHEN ec.valid_to::date < current_date THEN 'expired'
      WHEN (ec.valid_to::date - current_date) <= 7 THEN 'expiring_7'
      WHEN (ec.valid_to::date - current_date) <= 30 THEN 'expiring_30'
      ELSE 'valid'
    END AS bucket
  FROM roster_required rr
  LEFT JOIN public.employee_compliance ec
    ON ec.org_id = rr.org_id
    AND ec.employee_id = rr.employee_id
    AND ec.compliance_id = rr.compliance_id
),

-- Risk points per bucket (mirrors lib/compliance/rules.ts COMPLIANCE_RISK_POINTS)
risk_per_item AS (
  SELECT
    org_id,
    site_id,
    station_id,
    shift_code,
    employee_id,
    compliance_id,
    bucket,
    CASE bucket
      WHEN 'missing' THEN 20
      WHEN 'expired' THEN 12
      WHEN 'expiring_7' THEN 6
      WHEN 'expiring_30' THEN 3
      ELSE 0
    END AS risk_points
  FROM per_item
)

SELECT
  org_id,
  site_id,
  station_id,
  shift_code,
  COALESCE(SUM(risk_points), 0)::int AS compliance_risk_points,
  COUNT(*) FILTER (WHERE bucket IN ('missing', 'expired'))::int AS blockers_count,
  COUNT(*) FILTER (WHERE bucket IN ('expiring_7', 'expiring_30'))::int AS warnings_count
FROM risk_per_item
GROUP BY org_id, site_id, station_id, shift_code;

COMMENT ON VIEW public.v_cockpit_compliance_risk_station_shift IS
  'Aggregate compliance risk per station+shift for cockpit summary; mirrors evaluate.ts rules.';

GRANT SELECT ON public.v_cockpit_compliance_risk_station_shift TO authenticated;
