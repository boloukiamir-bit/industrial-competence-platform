-- Station-level breakdown RPC for Industrial Readiness (drilldown API). Idempotent: DROP IF EXISTS then CREATE.

DROP FUNCTION IF EXISTS public.calculate_industrial_readiness_station_breakdown(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.calculate_industrial_readiness_station_breakdown(
  p_org_id uuid, p_site_id uuid, p_shift_id uuid
)
RETURNS TABLE (
  station_id uuid, station_code text, station_name text, station_score numeric, station_reason_codes text[],
  required_operators_count int, eligible_operators_count int, compliance_blockers_count int,
  absence_ratio numeric, criticality_factor numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_shift_date date; v_shift_code text;
BEGIN
  SELECT sh.shift_date, sh.shift_code INTO v_shift_date, v_shift_code
  FROM public.shifts sh WHERE sh.id = p_shift_id AND sh.org_id = p_org_id AND sh.site_id = p_site_id;
  IF v_shift_date IS NULL OR v_shift_code IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH shift_ctx AS (SELECT v_shift_date AS shift_date, v_shift_code AS shift_code),
  sa AS (
    SELECT sa.station_id, COUNT(sa.employee_id)::int AS total_assigned,
      COUNT(sa.employee_id) FILTER (WHERE ar.id IS NOT NULL AND ar.status = 'absent')::int AS absent_count
    FROM public.shift_assignments sa
    JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = p_org_id AND sh.site_id = p_site_id
    LEFT JOIN public.attendance_records ar ON ar.org_id = p_org_id AND ar.employee_id = sa.employee_id
      AND ar.work_date = (SELECT shift_date FROM shift_ctx) AND ar.shift_type = (SELECT shift_code FROM shift_ctx)
    WHERE sa.org_id = p_org_id AND sa.shift_id = p_shift_id GROUP BY sa.station_id
  ),
  roster_agg AS (
    SELECT r.station_id, COUNT(*)::int AS roster_headcount, COUNT(*) FILTER (WHERE r.status = 'GO')::int AS go_count
    FROM public.v_roster_station_shift_drilldown_pilot r
    WHERE r.org_id = p_org_id AND r.site_id = p_site_id AND r.plan_date::date = (SELECT shift_date FROM shift_ctx)
      AND r.shift_code = (SELECT shift_code FROM shift_ctx) GROUP BY r.station_id
  ),
  illegal_per_station AS (
    SELECT sa.station_id, COUNT(DISTINCT sa.employee_id)::int AS compliance_blockers_count
    FROM public.shift_assignments sa
    JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = p_org_id AND sh.site_id = p_site_id
    CROSS JOIN shift_ctx sc
    JOIN public.compliance_catalog cc ON cc.org_id = p_org_id AND cc.is_active = true AND cc.is_blocking = true
      AND (cc.site_id IS NULL OR cc.site_id = p_site_id)
    LEFT JOIN public.employee_compliance ec ON ec.org_id = p_org_id AND ec.employee_id = sa.employee_id AND ec.compliance_id = cc.id
    WHERE sa.org_id = p_org_id AND sa.shift_id = p_shift_id AND sa.employee_id IS NOT NULL
      AND (COALESCE(ec.waived, false) = false) AND (ec.id IS NULL OR ec.valid_to IS NULL OR ec.valid_to::date < sc.shift_date)
    GROUP BY sa.station_id
  ),
  station_inputs AS (
    SELECT sa.station_id, sa.total_assigned, sa.absent_count, ra.roster_headcount AS required_operators_count,
      COALESCE(ra.go_count, 0)::int AS eligible_operators_count, COALESCE(il.compliance_blockers_count, 0)::int AS compliance_blockers_count,
      COALESCE(st.criticality_level, 1)::numeric AS criticality_factor
    FROM sa LEFT JOIN roster_agg ra ON ra.station_id = sa.station_id LEFT JOIN illegal_per_station il ON il.station_id = sa.station_id
    JOIN public.stations st ON st.id = sa.station_id AND st.org_id = p_org_id
  ),
  station_scores AS (
    SELECT si.station_id,
      CASE WHEN si.required_operators_count IS NULL OR si.required_operators_count = 0 THEN 0 WHEN si.compliance_blockers_count > 0 THEN 0
      ELSE GREATEST(0, LEAST(100, ((si.eligible_operators_count::numeric / NULLIF(si.required_operators_count, 0)) * 100
        - (si.absent_count::numeric / NULLIF(si.total_assigned, 0)) * 20) * si.criticality_factor)) END AS station_score,
      COALESCE((SELECT array_agg(reason ORDER BY reason) FROM (
        SELECT 'COMPLIANCE_BLOCKER' AS reason WHERE si.compliance_blockers_count > 0
        UNION ALL SELECT 'NO_ROSTER' WHERE si.required_operators_count IS NULL OR si.required_operators_count = 0
        UNION ALL SELECT 'LOW_SKILL_COVERAGE' WHERE si.required_operators_count IS NOT NULL AND si.required_operators_count > 0 AND (si.eligible_operators_count::numeric / NULLIF(si.required_operators_count, 0)) < 1
        UNION ALL SELECT 'HIGH_ABSENCE' WHERE si.total_assigned > 0 AND (si.absent_count::numeric / si.total_assigned) >= 0.1
      ) sub), ARRAY[]::text[]) AS station_reason_codes
    FROM station_inputs si
  ),
  breakdown AS (
    SELECT ss.station_id, st.code AS station_code, st.name AS station_name, ss.station_score, ss.station_reason_codes,
      si.required_operators_count, si.eligible_operators_count, si.compliance_blockers_count,
      (si.absent_count::numeric / NULLIF(si.total_assigned, 0)) AS absence_ratio, si.criticality_factor
    FROM station_scores ss JOIN station_inputs si ON si.station_id = ss.station_id
    JOIN public.stations st ON st.id = ss.station_id AND st.org_id = p_org_id
  )
  SELECT b.station_id, b.station_code, b.station_name, b.station_score, b.station_reason_codes,
    b.required_operators_count, b.eligible_operators_count, b.compliance_blockers_count,
    COALESCE(b.absence_ratio, 0)::numeric, b.criticality_factor
  FROM breakdown b ORDER BY b.station_score ASC, b.station_code ASC;
END;
$$;

COMMENT ON FUNCTION public.calculate_industrial_readiness_station_breakdown(uuid, uuid, uuid) IS
  'Station-level breakdown for Industrial Readiness; same logic as v1.1. For drilldown/explainability.';

GRANT EXECUTE ON FUNCTION public.calculate_industrial_readiness_station_breakdown(uuid, uuid, uuid) TO authenticated;
