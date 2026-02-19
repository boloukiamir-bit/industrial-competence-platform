-- Phase B: Compliance Matrix 2.0 Evaluator – deterministic RPC per station/shift.
-- Evaluates compliance legality per station for a given shift scope (org, site, date, shift_code).
-- Uses compliance_requirement_bindings (ORG/ROLE/STATION) + catalog + employee_compliance.
-- SECURITY DEFINER with search_path = public; caller passes org_id/site_id (tenant-scoped).

CREATE OR REPLACE FUNCTION public.calculate_compliance_station_shift_v2(
  p_org_id uuid,
  p_site_id uuid,
  p_shift_date date,
  p_shift_code text
)
RETURNS TABLE (
  station_id uuid,
  blocking_count int,
  warning_count int,
  legal_stop boolean,
  reason_codes text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shift_ctx AS (
    SELECT s.id AS shift_id, s.shift_date::date AS shift_date
    FROM public.shifts s
    WHERE s.org_id = p_org_id
      AND s.site_id = p_site_id
      AND s.shift_date = p_shift_date
      AND s.shift_code = p_shift_code
    ORDER BY s.id
    LIMIT 1
  ),
  roster AS (
    SELECT sa.station_id, sa.employee_id
    FROM public.shift_assignments sa
    JOIN shift_ctx sc ON sc.shift_id = sa.shift_id
    WHERE sa.org_id = p_org_id
      AND sa.employee_id IS NOT NULL
  ),
  catalog AS (
    SELECT cc.id AS compliance_id, cc.code AS compliance_code,
      COALESCE(cc.validity_type, 'EXPIRY_DATE') AS validity_type,
      COALESCE(cc.legal_blocking, cc.is_blocking, true) AS legal_blocking,
      COALESCE(cc.default_warning_window_days, 30) AS default_warning_window_days
    FROM public.compliance_catalog cc
    WHERE cc.org_id = p_org_id
      AND (COALESCE(cc.active, cc.is_active, true) = true)
  ),
  bindings_org AS (
    SELECT r.station_id, r.employee_id, b.compliance_code,
      COALESCE(b.legal_blocking_override, c.legal_blocking) AS legal_blocking,
      COALESCE(b.warning_window_days_override, c.default_warning_window_days) AS warning_window_days,
      3 AS scope_ord
    FROM roster r
    CROSS JOIN public.compliance_requirement_bindings b
    JOIN catalog c ON c.compliance_code = b.compliance_code
    WHERE b.org_id = p_org_id
      AND b.scope_type = 'ORG'
      AND (b.site_id IS NULL OR b.site_id = p_site_id)
      AND b.disabled = false
  ),
  bindings_role AS (
    SELECT r.station_id, r.employee_id, b.compliance_code,
      COALESCE(b.legal_blocking_override, c.legal_blocking) AS legal_blocking,
      COALESCE(b.warning_window_days_override, c.default_warning_window_days) AS warning_window_days,
      2 AS scope_ord
    FROM roster r
    JOIN public.employee_roles er ON er.org_id = p_org_id AND er.employee_id = r.employee_id
    JOIN public.compliance_requirement_bindings b
      ON b.org_id = p_org_id AND b.scope_type = 'ROLE' AND b.role_id = er.role_id AND b.disabled = false
    JOIN catalog c ON c.compliance_code = b.compliance_code
  ),
  bindings_station AS (
    SELECT r.station_id, r.employee_id, b.compliance_code,
      COALESCE(b.legal_blocking_override, c.legal_blocking) AS legal_blocking,
      COALESCE(b.warning_window_days_override, c.default_warning_window_days) AS warning_window_days,
      1 AS scope_ord
    FROM roster r
    JOIN public.compliance_requirement_bindings b
      ON b.org_id = p_org_id AND b.scope_type = 'STATION' AND b.station_id = r.station_id AND b.disabled = false
    JOIN catalog c ON c.compliance_code = b.compliance_code
  ),
  requirements AS (
    SELECT DISTINCT ON (station_id, employee_id, compliance_code)
      station_id, employee_id, compliance_code, legal_blocking, warning_window_days
    FROM (
      SELECT station_id, employee_id, compliance_code, legal_blocking, warning_window_days, scope_ord FROM bindings_org
      UNION ALL
      SELECT station_id, employee_id, compliance_code, legal_blocking, warning_window_days, scope_ord FROM bindings_role
      UNION ALL
      SELECT station_id, employee_id, compliance_code, legal_blocking, warning_window_days, scope_ord FROM bindings_station
    ) u
    ORDER BY station_id, employee_id, compliance_code, scope_ord
  ),
  req_with_catalog AS (
    SELECT req.station_id, req.employee_id, req.compliance_code, req.legal_blocking, req.warning_window_days,
      c.compliance_id, c.validity_type
    FROM requirements req
    JOIN catalog c ON c.compliance_code = req.compliance_code
  ),
  eval AS (
    SELECT
      r.station_id,
      r.compliance_code,
      r.legal_blocking,
      r.warning_window_days,
      r.validity_type,
      sc.shift_date,
      CASE
        WHEN COALESCE(ec.waived, false) THEN 'VALID'
        WHEN ec.id IS NULL THEN 'MISSING'
        WHEN r.validity_type = 'NONE' THEN 'VALID'
        WHEN ec.valid_to IS NULL THEN 'MISSING'
        WHEN ec.valid_to::date < sc.shift_date THEN 'EXPIRED'
        WHEN ec.valid_to <= (sc.shift_date + r.warning_window_days) THEN 'EXPIRING'
        ELSE 'VALID'
      END AS status
    FROM req_with_catalog r
    CROSS JOIN shift_ctx sc
    LEFT JOIN public.employee_compliance ec
      ON ec.org_id = p_org_id
      AND ec.employee_id = r.employee_id
      AND ec.compliance_id = r.compliance_id
  ),
  per_station AS (
    SELECT
      e.station_id,
      COUNT(*) FILTER (WHERE e.legal_blocking AND e.status IN ('MISSING', 'EXPIRED'))::int AS blocking_count,
      COUNT(*) FILTER (WHERE e.status = 'EXPIRING')::int AS warning_count,
      array_agg(DISTINCT
        CASE
          WHEN e.legal_blocking AND e.status = 'MISSING' THEN 'COMPLIANCE_MISSING'
          WHEN e.legal_blocking AND e.status = 'EXPIRED' THEN 'COMPLIANCE_EXPIRED'
          WHEN e.status = 'EXPIRING' THEN 'COMPLIANCE_EXPIRING'
          ELSE NULL
        END
      ) FILTER (WHERE
        (e.legal_blocking AND e.status IN ('MISSING', 'EXPIRED')) OR e.status = 'EXPIRING'
      ) AS reason_arr
    FROM eval e
    GROUP BY e.station_id
  )
  SELECT
    ps.station_id,
    ps.blocking_count,
    ps.warning_count,
    (ps.blocking_count > 0) AS legal_stop,
    COALESCE(
      (SELECT array_agg(rc ORDER BY rc) FROM unnest(ps.reason_arr) AS rc WHERE rc IS NOT NULL),
      '{}'
    ) AS reason_codes
  FROM per_station ps
  WHERE EXISTS (SELECT 1 FROM shift_ctx)
$$;

COMMENT ON FUNCTION public.calculate_compliance_station_shift_v2(uuid, uuid, date, text) IS
  'Phase B: Deterministic compliance legality per station for a shift (org, site, date, shift_code). Returns blocking_count, warning_count, legal_stop, reason_codes. No rows if shift not found.';

GRANT EXECUTE ON FUNCTION public.calculate_compliance_station_shift_v2(uuid, uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_compliance_station_shift_v2(uuid, uuid, date, text) TO service_role;
