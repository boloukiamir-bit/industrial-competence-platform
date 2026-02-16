-- v_employee_compliance_status: employee × catalog compliance status for Compliance Matrix.
-- One row per (employee, catalog_item). Status: MISSING | EXPIRED | EXPIRING_7 | EXPIRING_30 | VALID.
-- Used by GET /api/compliance/matrix for aggregated per-employee risk and blockers/warnings.
-- site_id: COALESCE(employee_compliance.site_id, employees.site_id, null) — view does not require site_id on employees.

CREATE OR REPLACE VIEW public.v_employee_compliance_status
WITH (security_invoker = true)
AS
SELECT
  e.org_id,
  COALESCE(ec.site_id, e.site_id, NULL)::uuid AS site_id,
  e.id AS employee_id,
  cc.code AS compliance_code,
  cc.name AS compliance_name,
  cc.category,
  ec.valid_to,
  COALESCE(ec.waived, false) AS waived,
  CASE
    WHEN COALESCE(ec.waived, false) THEN 'VALID'
    WHEN ec.id IS NULL THEN 'MISSING'
    WHEN ec.valid_to IS NULL THEN 'MISSING'
    WHEN ec.valid_to::date < current_date THEN 'EXPIRED'
    WHEN (ec.valid_to::date - current_date) <= 7 THEN 'EXPIRING_7'
    WHEN (ec.valid_to::date - current_date) <= 30 THEN 'EXPIRING_30'
    ELSE 'VALID'
  END::text AS status,
  CASE
    WHEN COALESCE(ec.waived, false) OR ec.valid_to IS NULL THEN NULL
    ELSE (ec.valid_to::date - current_date)::int
  END AS days_left
FROM public.employees e
JOIN public.compliance_catalog cc
  ON cc.org_id = e.org_id
  AND cc.is_active = true
  AND cc.category IN (
    'work_environment', 'medical_control', 'medical_training',
    'customer_requirement', 'sustainability'
  )
LEFT JOIN public.employee_compliance ec
  ON ec.org_id = e.org_id
  AND ec.employee_id = e.id
  AND ec.compliance_id = cc.id
WHERE e.org_id IS NOT NULL
  AND COALESCE(e.is_active, true) = true;

COMMENT ON VIEW public.v_employee_compliance_status IS
  'Per-employee per-catalog compliance status for Compliance Matrix; status aligns with rules.ts.';

GRANT SELECT ON public.v_employee_compliance_status TO authenticated;
