-- Requirement Criticality Level V1. No driver refactor. Model extension + summary impact only.

-- =============================================================================
-- 1) compliance_requirements: criticality
-- =============================================================================
ALTER TABLE public.compliance_requirements
  ADD COLUMN IF NOT EXISTS criticality text NOT NULL DEFAULT 'MEDIUM';

ALTER TABLE public.compliance_requirements
  DROP CONSTRAINT IF EXISTS compliance_requirements_criticality_check;

ALTER TABLE public.compliance_requirements
  ADD CONSTRAINT compliance_requirements_criticality_check
  CHECK (criticality IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));

COMMENT ON COLUMN public.compliance_requirements.criticality IS 'V1: CRITICAL | HIGH | MEDIUM | LOW. Used by v_employee_requirement_status when binding is catalog-linked.';

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_org_criticality
  ON public.compliance_requirements(org_id, criticality);

-- =============================================================================
-- 2) requirement_role_rules: criticality_override
-- =============================================================================
ALTER TABLE public.requirement_role_rules
  ADD COLUMN IF NOT EXISTS criticality_override text NULL;

ALTER TABLE public.requirement_role_rules
  DROP CONSTRAINT IF EXISTS requirement_role_rules_criticality_override_check;

ALTER TABLE public.requirement_role_rules
  ADD CONSTRAINT requirement_role_rules_criticality_override_check
  CHECK (criticality_override IS NULL OR criticality_override IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));

COMMENT ON COLUMN public.requirement_role_rules.criticality_override IS 'Override catalog criticality for synthetic MISSING_REQUIRED rows; null = MEDIUM.';

-- =============================================================================
-- 3) v_employee_requirement_status: add criticality (new column at end)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_employee_requirement_status AS
-- A) Existing bindings: criticality from catalog when requirement_id set, else MEDIUM
SELECT
  b.org_id,
  b.site_id,
  b.employee_id,
  b.requirement_code,
  b.requirement_name,
  b.valid_from,
  b.valid_to,
  b.status_override,
  b.evidence_url,
  b.note,
  CASE
    WHEN b.status_override IS NOT NULL THEN b.status_override
    WHEN b.valid_to IS NULL THEN 'WARNING'
    WHEN b.valid_to < (current_timestamp AT TIME ZONE 'UTC')::date THEN 'ILLEGAL'
    WHEN b.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'WARNING'
    ELSE 'GO'
  END AS computed_status,
  CASE
    WHEN b.status_override IS NOT NULL THEN 'OVERRIDDEN'
    WHEN b.valid_to IS NULL THEN 'MISSING_EXPIRY'
    WHEN b.valid_to < (current_timestamp AT TIME ZONE 'UTC')::date THEN 'EXPIRED'
    WHEN b.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END AS status_reason,
  b.requirement_id,
  COALESCE(cr.criticality, 'MEDIUM')::text AS criticality
FROM public.employee_requirement_bindings b
LEFT JOIN public.compliance_requirements cr ON cr.id = b.requirement_id AND cr.org_id = b.org_id

UNION ALL

-- B) Synthetic rows: criticality from rule override or MEDIUM
SELECT DISTINCT ON (employee_id, requirement_code)
  e.org_id,
  e.site_id,
  e.id AS employee_id,
  rule.requirement_code,
  rule.requirement_name,
  NULL::date AS valid_from,
  NULL::date AS valid_to,
  NULL::text AS status_override,
  NULL::text AS evidence_url,
  NULL::text AS note,
  'ILLEGAL'::text AS computed_status,
  'MISSING_REQUIRED'::text AS status_reason,
  NULL::uuid AS requirement_id,
  COALESCE(rule.criticality_override, 'MEDIUM')::text AS criticality
FROM public.employees e
JOIN public.employee_roles er ON er.employee_id = e.id AND er.org_id = e.org_id
JOIN public.roles r ON r.id = er.role_id AND r.org_id = e.org_id
JOIN public.requirement_role_rules rule ON rule.org_id = e.org_id AND rule.role = r.code AND rule.is_mandatory = true
LEFT JOIN public.employee_requirement_bindings b
  ON b.org_id = e.org_id AND b.employee_id = e.id AND b.requirement_code = rule.requirement_code
WHERE b.id IS NULL
ORDER BY employee_id, requirement_code, requirement_name;

COMMENT ON VIEW public.v_employee_requirement_status IS 'Deterministic status per binding or missing mandatory rule. criticality: from catalog when linked, else rule override or MEDIUM.';

-- =============================================================================
-- 4) get_requirements_summary_v1: add blocking_critical, blocking_high
-- =============================================================================
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
      'go', c.go,
      'blocking_critical', c.blocking_critical,
      'blocking_high', c.blocking_high
    ) AS counts
    FROM (
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE v.computed_status = 'ILLEGAL')::int AS illegal,
        count(*) FILTER (WHERE v.computed_status = 'WARNING')::int AS warning,
        count(*) FILTER (WHERE v.computed_status = 'GO')::int AS go,
        count(*) FILTER (WHERE v.computed_status = 'ILLEGAL' AND v.criticality = 'CRITICAL')::int AS blocking_critical,
        count(*) FILTER (WHERE v.computed_status = 'ILLEGAL' AND v.criticality = 'HIGH')::int AS blocking_high
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
  'Aggregate requirement status counts (incl. blocking_critical, blocking_high) and top 10. Tenant-scoped.';
