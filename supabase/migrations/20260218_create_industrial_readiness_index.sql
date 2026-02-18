-- Industrial Readiness Index v1: deterministic RPC for shift-level readiness.
-- Multi-tenant safe (org_id + site_id). No heuristics, no randomness.

-- =============================================================================
-- 1) stations.criticality_level (1–1.5, default 1)
-- =============================================================================
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS criticality_level numeric NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stations'::regclass
      AND conname = 'stations_criticality_level_range'
  ) THEN
    ALTER TABLE public.stations
      ADD CONSTRAINT stations_criticality_level_range
      CHECK (criticality_level >= 1 AND criticality_level <= 1.5);
  END IF;
END $$;

COMMENT ON COLUMN public.stations.criticality_level IS 'Factor 1–1.5 for Industrial Readiness station score; default 1.';

-- =============================================================================
-- 2) RPC: calculate_industrial_readiness(p_org_id, p_site_id, p_shift_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_industrial_readiness(
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_date date;
  v_shift_code text;
BEGIN
  -- Resolve shift (tenant-scoped)
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
    calculated_at := now();
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- Shift context (single row)
  shift_ctx AS (
    SELECT v_shift_date AS shift_date, v_shift_code AS shift_code
  ),
  -- Assignments for this shift (org + site via join to shifts)
  sa AS (
    SELECT
      sa.station_id,
      COUNT(sa.employee_id)::int AS total_assigned,
      COUNT(sa.employee_id) FILTER (WHERE ar.id IS NOT NULL AND ar.status = 'absent')::int AS absent_count,
      array_agg(sa.employee_id) FILTER (WHERE sa.employee_id IS NOT NULL) AS employee_ids
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
  -- Roster-based eligible vs required (from drilldown for this shift date/code/site)
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
  -- Compliance blockers per station (assigned employees with blocking compliance missing/expired)
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
  -- Station-level inputs
  station_inputs AS (
    SELECT
      sa.station_id,
      sa.total_assigned,
      sa.absent_count,
      COALESCE(ra.roster_headcount, 1)::int AS required_operators_count,
      COALESCE(ra.go_count, 0)::int AS eligible_operators_count,
      COALESCE(il.compliance_blockers_count, 0)::int AS compliance_blockers_count,
      COALESCE(st.criticality_level, 1)::numeric AS criticality_factor
    FROM sa
    LEFT JOIN roster_agg ra ON ra.station_id = sa.station_id
    LEFT JOIN illegal_per_station il ON il.station_id = sa.station_id
    JOIN public.stations st ON st.id = sa.station_id AND st.org_id = p_org_id
  ),
  -- Station score (0–100): base = skill_coverage_ratio*100; compliance_blockers>0 => 0; else subtract absence, apply criticality, clamp
  station_scores AS (
    SELECT
      si.station_id,
      CASE
        WHEN si.compliance_blockers_count > 0 THEN 0
        ELSE GREATEST(0, LEAST(100,
          (
            (si.eligible_operators_count::numeric / NULLIF(si.required_operators_count, 0)) * 100
            - (si.absent_count::numeric / NULLIF(si.total_assigned, 0)) * 20
          ) * si.criticality_factor
        ))
      END AS station_score
    FROM station_inputs si
  ),
  agg AS (
    SELECT
      COALESCE(AVG(ss.station_score), 0)::numeric AS score,
      BOOL_OR(ss.station_score = 0) AS any_zero,
      array_agg(ss.station_id) FILTER (WHERE ss.station_score = 0) AS blockers
    FROM station_scores ss
  )
  SELECT
    agg.score,
    CASE
      WHEN agg.any_zero THEN 'NO_GO'::text
      WHEN agg.score < 75 THEN 'WARNING'::text
      ELSE 'GO'::text
    END,
    COALESCE(agg.blockers, ARRAY[]::uuid[]),
    now()
  FROM agg;
END;
$$;

COMMENT ON FUNCTION public.calculate_industrial_readiness(uuid, uuid, uuid) IS
  'Industrial Readiness Index v1: deterministic readiness per shift. Returns readiness_score (0–100), status (NO_GO/WARNING/GO), blocking_stations, calculated_at. Multi-tenant safe.';

GRANT EXECUTE ON FUNCTION public.calculate_industrial_readiness(uuid, uuid, uuid) TO authenticated;
