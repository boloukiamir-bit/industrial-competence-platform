-- RPC for Compliance Matrix: SQL aggregation from v_employee_compliance_status.
-- Returns { summary, rows } for org_id + optional site_id filter.
-- Tenant-safe: caller passes org_id; site_id optional (null = no site filter).

CREATE OR REPLACE FUNCTION public.get_compliance_matrix_aggregated(
  p_org_id uuid,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH filtered AS (
    SELECT *
    FROM public.v_employee_compliance_status v
    WHERE v.org_id = p_org_id
      AND (
        p_site_id IS NULL
        OR v.site_id = p_site_id
        OR v.site_id IS NULL
      )
  ),
  per_employee AS (
    SELECT
      employee_id,
      COUNT(*) FILTER (WHERE status IN ('MISSING', 'EXPIRED'))::int AS blockers_count,
      COUNT(*) FILTER (WHERE status IN ('EXPIRING_7', 'EXPIRING_30'))::int AS warnings_count,
      COALESCE(SUM(CASE status
        WHEN 'MISSING' THEN 20
        WHEN 'EXPIRED' THEN 12
        WHEN 'EXPIRING_7' THEN 6
        WHEN 'EXPIRING_30' THEN 3
        ELSE 0
      END), 0)::int AS risk_points
    FROM filtered
    GROUP BY employee_id
  ),
  with_names AS (
    SELECT
      pe.employee_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
        e.employee_number::text,
        '—'
      ) AS name,
      pe.blockers_count,
      pe.warnings_count,
      pe.risk_points
    FROM per_employee pe
    JOIN public.employees e ON e.id = pe.employee_id AND e.org_id = p_org_id
  ),
  summary_data AS (
    SELECT
      COUNT(*)::int AS total_employees,
      COUNT(*) FILTER (WHERE blockers_count > 0)::int AS employees_with_blockers,
      COUNT(*) FILTER (WHERE warnings_count > 0)::int AS employees_with_warnings,
      COALESCE(SUM(risk_points), 0)::int AS total_risk_points
    FROM with_names
  )
  SELECT jsonb_build_object(
    'summary', (SELECT to_jsonb(s) FROM summary_data s),
    'rows', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'employee_id', employee_id,
          'name', name,
          'blockers_count', blockers_count,
          'warnings_count', warnings_count,
          'risk_points', risk_points,
          'readiness_status', CASE
            WHEN blockers_count > 0 THEN 'NOT_SCHEDULABLE'
            WHEN blockers_count = 0 AND warnings_count > 0 THEN 'AT_RISK'
            ELSE 'READY'
          END
        )
        ORDER BY name
      ) FROM with_names),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.get_compliance_matrix_aggregated(uuid, uuid) IS
  'Compliance Matrix aggregation: per-employee blockers/warnings/risk from v_employee_compliance_status.';
