-- Requirements summary aggregation in DB (enterprise-safe). No UI changes.
-- RPC: get_requirements_summary_v1. Auth: caller active_org_id must match p_org_id.

CREATE OR REPLACE FUNCTION public.get_requirements_summary_v1(p_org_id uuid, p_site_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_org_id uuid;
  v_result json;
BEGIN
  -- Auth guard: caller active org must match p_org_id
  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT json_build_object(
    'counts', counts_row.counts,
    'top_requirements', top_row.top_requirements
  ) INTO v_result
  FROM (
    SELECT json_build_object(
      'total', c.total,
      'illegal', c.illegal,
      'warning', c.warning,
      'go', c.go
    ) AS counts
    FROM (
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE v.computed_status = 'ILLEGAL')::int AS illegal,
        count(*) FILTER (WHERE v.computed_status = 'WARNING')::int AS warning,
        count(*) FILTER (WHERE v.computed_status = 'GO')::int AS go
      FROM public.v_employee_requirement_status v
      WHERE v.org_id = p_org_id
        AND (p_site_id IS NULL OR v.site_id = p_site_id OR v.site_id IS NULL)
    ) c
  ) counts_row,
  LATERAL (
    SELECT coalesce(
      json_agg(
        json_build_object(
          'requirement_code', t.requirement_code,
          'requirement_name', coalesce(t.requirement_name, ''),
          'illegal', t.illegal,
          'warning', t.warning,
          'total', t.total
        ) ORDER BY t.ord_illegal_warning DESC, t.illegal DESC, t.warning DESC, t.requirement_code ASC
      ),
      '[]'::json
    ) AS top_requirements
    FROM (
      SELECT
        requirement_code,
        requirement_name,
        count(*) FILTER (WHERE computed_status = 'ILLEGAL')::int AS illegal,
        count(*) FILTER (WHERE computed_status = 'WARNING')::int AS warning,
        count(*)::int AS total,
        (count(*) FILTER (WHERE computed_status = 'ILLEGAL') + count(*) FILTER (WHERE computed_status = 'WARNING')) AS ord_illegal_warning
      FROM public.v_employee_requirement_status v
      WHERE v.org_id = p_org_id
        AND (p_site_id IS NULL OR v.site_id = p_site_id OR v.site_id IS NULL)
      GROUP BY requirement_code, requirement_name
      ORDER BY ord_illegal_warning DESC, illegal DESC, warning DESC, requirement_code ASC
      LIMIT 10
    ) t
  ) top_row;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_requirements_summary_v1(uuid, uuid) IS
  'Aggregate requirement status counts and top 10 by illegal+warning. Tenant-scoped; enforces p_org_id = caller active_org_id.';

GRANT EXECUTE ON FUNCTION public.get_requirements_summary_v1(uuid, uuid) TO authenticated;
