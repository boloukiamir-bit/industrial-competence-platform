-- Fix 42P01: ORDER BY / DISTINCT ON in v_employee_requirement_status must not reference subquery aliases (e, rule).
-- Use only view output column names so the view definition is valid in all contexts.

CREATE OR REPLACE VIEW public.v_employee_requirement_status AS
-- A) Existing bindings with current computed status
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
  END AS status_reason
FROM public.employee_requirement_bindings b

UNION ALL

-- B) Synthetic rows: mandatory rules with no binding (employee has role, rule applies, binding missing)
-- DISTINCT ON / ORDER BY use only output column names to avoid 42P01 (alias out of scope)
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
  'MISSING_REQUIRED'::text AS status_reason
FROM public.employees e
JOIN public.employee_roles er ON er.employee_id = e.id AND er.org_id = e.org_id
JOIN public.roles r ON r.id = er.role_id AND r.org_id = e.org_id
JOIN public.requirement_role_rules rule ON rule.org_id = e.org_id AND rule.role = r.code AND rule.is_mandatory = true
LEFT JOIN public.employee_requirement_bindings b
  ON b.org_id = e.org_id AND b.employee_id = e.id AND b.requirement_code = rule.requirement_code
WHERE b.id IS NULL
ORDER BY employee_id, requirement_code, requirement_name;

COMMENT ON VIEW public.v_employee_requirement_status IS 'Deterministic status per binding or missing mandatory rule: OVERRIDDEN | MISSING_EXPIRY | EXPIRED | EXPIRING_SOON | VALID | MISSING_REQUIRED (synthetic). V1: 30-day window; role rules read-only enforcement.';
