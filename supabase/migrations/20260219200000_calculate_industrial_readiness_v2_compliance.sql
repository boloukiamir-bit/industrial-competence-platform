-- Phase B: Bind Compliance Matrix 2.0 into Readiness (deterministic).
-- New RPC calculate_industrial_readiness_v2 integrates compliance via calculate_compliance_station_shift_v2.
-- Does NOT replace calculate_industrial_readiness; callers opt-in to v2.

CREATE OR REPLACE FUNCTION public.calculate_industrial_readiness_v2(
  p_org_id uuid,
  p_site_id uuid,
  p_shift_id uuid
)
RETURNS TABLE (
  readiness_score numeric,
  status text,
  blocking_stations uuid[],
  reason_codes text[],
  calculated_at timestamptz,
  legitimacy_status text,
  compliance jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_date date;
  v_shift_code text;
  v_base numeric;
  v_status text;
  v_blocking_stations uuid[];
  v_reason_codes text[];
  v_calc_at timestamptz;
  v_comp_stations jsonb;
  v_comp_totals jsonb;
  v_has_blocker boolean;
  v_has_warning boolean;
  v_merged_reasons text[];
  v_legitimacy text;
  v_final_status text;
BEGIN
  SELECT sh.shift_date, sh.shift_code INTO v_shift_date, v_shift_code
  FROM public.shifts sh
  WHERE sh.id = p_shift_id AND sh.org_id = p_org_id AND sh.site_id = p_site_id;

  IF v_shift_date IS NULL OR v_shift_code IS NULL THEN
    readiness_score := 0;
    status := 'NO_GO';
    blocking_stations := ARRAY[]::uuid[];
    reason_codes := ARRAY[]::text[];
    calculated_at := now();
    legitimacy_status := 'OK';
    compliance := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Base readiness (v1.1)
  SELECT r.readiness_score, r.status, r.blocking_stations, r.reason_codes, r.calculated_at
  INTO v_base, v_status, v_blocking_stations, v_reason_codes, v_calc_at
  FROM public.calculate_industrial_readiness(p_org_id, p_site_id, p_shift_id) r
  LIMIT 1;

  -- Compliance per station (only when shift exists; returns 0 rows if no shift in v2)
  WITH comp AS (
    SELECT
      c.station_id,
      c.legal_stop,
      c.blocking_count,
      c.warning_count,
      COALESCE(c.reason_codes, ARRAY[]::text[]) AS reason_codes
    FROM public.calculate_compliance_station_shift_v2(p_org_id, p_site_id, v_shift_date, v_shift_code) c
  ),
  comp_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE comp.legal_stop)::int AS blocking_stations,
      COUNT(*) FILTER (WHERE comp.warning_count > 0)::int AS warning_stations,
      COALESCE(SUM(comp.blocking_count) FILTER (WHERE comp.legal_stop), 0)::int AS blocking_items,
      COALESCE(SUM(comp.warning_count), 0)::int AS warning_items,
      BOOL_OR(comp.legal_stop) AS any_legal_stop,
      BOOL_OR(comp.warning_count > 0) AS any_warning
    FROM comp
  ),
  stations_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'station_id', comp.station_id,
          'legal_stop', comp.legal_stop,
          'blocking_count', comp.blocking_count,
          'warning_count', comp.warning_count,
          'reason_codes', (
            SELECT array_agg(rc ORDER BY rc)
            FROM unnest(COALESCE(comp.reason_codes, ARRAY[]::text[])) AS rc
          )
        )
        ORDER BY comp.station_id
      ),
      '[]'::jsonb
    ) AS arr
    FROM comp
  ),
  reason_from_comp AS (
    SELECT array_agg(DISTINCT code ORDER BY code) AS codes
    FROM (
      SELECT unnest(comp.reason_codes) AS code
      FROM comp
      WHERE comp.legal_stop
      UNION
      SELECT 'COMPLIANCE_EXPIRING'
      FROM comp_agg
      WHERE comp_agg.any_warning AND NOT comp_agg.any_legal_stop
      LIMIT 1
    ) x
    WHERE code IN ('COMPLIANCE_MISSING', 'COMPLIANCE_EXPIRED', 'COMPLIANCE_EXPIRING')
  )
  SELECT
    ca.any_legal_stop,
    ca.any_warning,
    sj.arr,
    jsonb_build_object(
      'blocking_stations', COALESCE(ca.blocking_stations, 0),
      'warning_stations', COALESCE(ca.warning_stations, 0),
      'blocking_items', COALESCE(ca.blocking_items, 0),
      'warning_items', COALESCE(ca.warning_items, 0)
    ),
    COALESCE(rfc.codes, ARRAY[]::text[])
  INTO v_has_blocker, v_has_warning, v_comp_stations, v_comp_totals, v_merged_reasons
  FROM comp_agg ca
  CROSS JOIN stations_json sj
  LEFT JOIN reason_from_comp rfc ON true;

  -- When no compliance rows (no bindings / no assignments), comp_agg may be empty
  IF v_has_blocker IS NULL THEN
    v_has_blocker := false;
    v_has_warning := false;
    v_comp_stations := '[]'::jsonb;
    v_comp_totals := jsonb_build_object(
      'blocking_stations', 0, 'warning_stations', 0,
      'blocking_items', 0, 'warning_items', 0
    );
    v_merged_reasons := ARRAY[]::text[];
  END IF;

  v_legitimacy := CASE WHEN v_has_blocker THEN 'LEGAL_STOP' ELSE 'OK' END;
  v_final_status := CASE WHEN v_has_blocker THEN 'NO_GO' ELSE v_status END;

  readiness_score := v_base;
  status := v_final_status;
  blocking_stations := v_blocking_stations;
  reason_codes := (
    SELECT array_agg(DISTINCT code ORDER BY code)
    FROM unnest(v_reason_codes || v_merged_reasons) AS code
  );
  calculated_at := v_calc_at;
  legitimacy_status := v_legitimacy;
  compliance := jsonb_build_object(
    'stations', COALESCE(v_comp_stations, '[]'::jsonb),
    'totals', COALESCE(v_comp_totals, jsonb_build_object(
      'blocking_stations', 0, 'warning_stations', 0,
      'blocking_items', 0, 'warning_items', 0
    ))
  );
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.calculate_industrial_readiness_v2(uuid, uuid, uuid) IS
  'Industrial Readiness v2: same as v1.1 plus compliance from bindings (ORG/ROLE/STATION). Returns legitimacy_status, compliance { stations, totals }; staffed station with legal_stop -> NO_GO + LEGAL_STOP.';

GRANT EXECUTE ON FUNCTION public.calculate_industrial_readiness_v2(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_industrial_readiness_v2(uuid, uuid, uuid) TO service_role;
