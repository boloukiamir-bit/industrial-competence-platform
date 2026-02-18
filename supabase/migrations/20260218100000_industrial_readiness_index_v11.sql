-- Industrial Readiness Index v1.1: weighted readiness, reason_codes, no roster fallback.
-- Replaces v1: required=roster only (no fallback to 1); station_score=0 when no roster; weighted average; reason_codes.
--
-- DROP required: PostgreSQL cannot change the RETURNS TABLE (out-parameter row type) of an existing
-- function. We drop the old 4-column signature and recreate with 5 columns in this migration.
-- Legacy callers can use calculate_industrial_readiness_v1(...) for the old 4-column result.

DROP FUNCTION IF EXISTS public.calculate_industrial_readiness(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.calculate_industrial_readiness(
  p_org_id uuid,
  p_site_id uuid,
  p_shift_id uuid
)
RETURNS TABLE (
  readiness_score numeric,
  status text,
  blocking_stations uuid[],
  reason_codes text[],
  calculated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_date date;
  v_shift_code text;
BEGIN
  SELECT sh.shift_date, sh.shift_code
  INTO v_shift_date, v_shift_code
  FROM public.shifts sh
  WHERE sh.id = p_shift_id
    AND sh.org_id = p_org_id
    AND sh.site_id = p_site_id;

  IF v_shift_date IS NULL OR v_shift_code IS NULL THEN
    readiness_score := 0;
    status := 'NO_GO';
    blocking_stations := ARRAY[]::uuid[];
    reason_codes := ARRAY[]::text[];
    calculated_at := now();
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  shift_ctx AS (
    SELECT v_shift_date AS shift_date, v_shift_code AS shift_code
  ),
  sa AS (
    SELECT
      sa.station_id,
      COUNT(sa.employee_id)::int AS total_assigned,
      COUNT(sa.employee_id) FILTER (WHERE ar.id IS NOT NULL AND ar.status = 'absent')::int AS absent_count
    FROM public.shift_assignments sa
    JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = p_org_id AND sh.site_id = p_site_id
    LEFT JOIN public.attendance_records ar
      ON ar.org_id = p_org_id
      AND ar.employee_id = sa.employee_id
      AND ar.work_date = (SELECT shift_date FROM shift_ctx)
      AND ar.shift_type = (SELECT shift_code FROM shift_ctx)
    WHERE sa.org_id = p_org_id
      AND sa.shift_id = p_shift_id
    GROUP BY sa.station_id
  ),
  roster_agg AS (
    SELECT
      r.station_id,
      COUNT(*)::int AS roster_headcount,
      COUNT(*) FILTER (WHERE r.status = 'GO')::int AS go_count
    FROM public.v_roster_station_shift_drilldown_pilot r
    WHERE r.org_id = p_org_id
      AND r.site_id = p_site_id
      AND r.plan_date::date = (SELECT shift_date FROM shift_ctx)
      AND r.shift_code = (SELECT shift_code FROM shift_ctx)
    GROUP BY r.station_id
  ),
  illegal_per_station AS (
    SELECT
      sa.station_id,
      COUNT(DISTINCT sa.employee_id)::int AS compliance_blockers_count
    FROM public.shift_assignments sa
    JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = p_org_id AND sh.site_id = p_site_id
    CROSS JOIN shift_ctx sc
    JOIN public.compliance_catalog cc
      ON cc.org_id = p_org_id
      AND cc.is_active = true
      AND cc.is_blocking = true
      AND (cc.site_id IS NULL OR cc.site_id = p_site_id)
    LEFT JOIN public.employee_compliance ec
      ON ec.org_id = p_org_id
      AND ec.employee_id = sa.employee_id
      AND ec.compliance_id = cc.id
    WHERE sa.org_id = p_org_id
      AND sa.shift_id = p_shift_id
      AND sa.employee_id IS NOT NULL
      AND (COALESCE(ec.waived, false) = false)
      AND (ec.id IS NULL OR ec.valid_to IS NULL OR ec.valid_to::date < sc.shift_date)
    GROUP BY sa.station_id
  ),
  -- required = roster headcount only (no fallback to 1)
  station_inputs AS (
    SELECT
      sa.station_id,
      sa.total_assigned,
      sa.absent_count,
      ra.roster_headcount AS required_operators_count,
      COALESCE(ra.go_count, 0)::int AS eligible_operators_count,
      COALESCE(il.compliance_blockers_count, 0)::int AS compliance_blockers_count,
      COALESCE(st.criticality_level, 1)::numeric AS criticality_factor
    FROM sa
    LEFT JOIN roster_agg ra ON ra.station_id = sa.station_id
    LEFT JOIN illegal_per_station il ON il.station_id = sa.station_id
    JOIN public.stations st ON st.id = sa.station_id AND st.org_id = p_org_id
  ),
  -- Station score (0–100) and per-station reason_codes
  station_scores AS (
    SELECT
      si.station_id,
      CASE
        WHEN si.required_operators_count IS NULL OR si.required_operators_count = 0 THEN 0
        WHEN si.compliance_blockers_count > 0 THEN 0
        ELSE GREATEST(0, LEAST(100,
          (
            (si.eligible_operators_count::numeric / NULLIF(si.required_operators_count, 0)) * 100
            - (si.absent_count::numeric / NULLIF(si.total_assigned, 0)) * 20
          ) * si.criticality_factor
        ))
      END AS station_score,
      si.criticality_factor AS weight,
      COALESCE(
        (SELECT array_agg(reason ORDER BY reason)
         FROM (
           SELECT 'COMPLIANCE_BLOCKER' AS reason WHERE si.compliance_blockers_count > 0
           UNION ALL
           SELECT 'NO_ROSTER' WHERE si.required_operators_count IS NULL OR si.required_operators_count = 0
           UNION ALL
           SELECT 'LOW_SKILL_COVERAGE' WHERE si.required_operators_count IS NOT NULL AND si.required_operators_count > 0
             AND (si.eligible_operators_count::numeric / NULLIF(si.required_operators_count, 0)) < 1
           UNION ALL
           SELECT 'HIGH_ABSENCE' WHERE si.total_assigned > 0 AND (si.absent_count::numeric / si.total_assigned) >= 0.1
         ) sub),
        ARRAY[]::text[]
      ) AS station_reason_codes
    FROM station_inputs si
  ),
  agg AS (
    SELECT
      CASE WHEN COALESCE(SUM(ss.weight), 0) = 0 THEN 0
           ELSE SUM(ss.station_score * ss.weight) / SUM(ss.weight)
      END::numeric AS score,
      BOOL_OR(ss.station_score = 0) AS any_zero,
      array_agg(ss.station_id) FILTER (WHERE ss.station_score = 0) AS blockers,
      (SELECT array_agg(code ORDER BY code)
       FROM (SELECT DISTINCT code
             FROM station_scores ss2,
                  unnest(COALESCE(ss2.station_reason_codes, ARRAY[]::text[])) AS code) x) AS factory_reasons
    FROM station_scores ss
  ),
  no_stations AS (
    SELECT (SELECT COUNT(*) FROM station_scores) = 0 AS is_empty
  )
  SELECT
    CASE WHEN ns.is_empty THEN 0 ELSE agg.score END,
    CASE
      WHEN ns.is_empty THEN 'NO_GO'::text
      WHEN agg.any_zero THEN 'NO_GO'::text
      WHEN agg.score < 75 THEN 'WARNING'::text
      ELSE 'GO'::text
    END,
    COALESCE(agg.blockers, ARRAY[]::uuid[]),
    CASE WHEN ns.is_empty THEN ARRAY['NO_ASSIGNMENTS']::text[]
         ELSE COALESCE(agg.factory_reasons, ARRAY[]::text[])
    END,
    now()
  FROM agg
  CROSS JOIN no_stations ns;
END;
$$;

COMMENT ON FUNCTION public.calculate_industrial_readiness(uuid, uuid, uuid) IS
  'Industrial Readiness Index v1.1: weighted readiness by criticality, reason_codes, no roster fallback. Returns readiness_score, status, blocking_stations, reason_codes (sorted distinct), calculated_at.';

GRANT EXECUTE ON FUNCTION public.calculate_industrial_readiness(uuid, uuid, uuid) TO authenticated;

-- Legacy wrapper: same name as old v1, returns 4 columns for callers that expect (readiness_score, status, blocking_stations, calculated_at).
CREATE OR REPLACE FUNCTION public.calculate_industrial_readiness_v1(
  p_org_id uuid,
  p_site_id uuid,
  p_shift_id uuid
)
RETURNS TABLE (
  readiness_score numeric,
  status text,
  blocking_stations uuid[],
  calculated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.readiness_score,
    r.status,
    r.blocking_stations,
    r.calculated_at
  FROM public.calculate_industrial_readiness(p_org_id, p_site_id, p_shift_id) r;
$$;

COMMENT ON FUNCTION public.calculate_industrial_readiness_v1(uuid, uuid, uuid) IS
  'Legacy 4-column wrapper over calculate_industrial_readiness; use for callers expecting v1 return shape.';

GRANT EXECUTE ON FUNCTION public.calculate_industrial_readiness_v1(uuid, uuid, uuid) TO authenticated;

