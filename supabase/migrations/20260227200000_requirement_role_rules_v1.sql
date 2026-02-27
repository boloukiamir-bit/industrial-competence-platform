-- Requirement Role Rules v1: read-only enforcement. Mandatory rules show as ILLEGAL+MISSING_REQUIRED when no binding.
-- Table: public.requirement_role_rules. View: v_employee_requirement_status extended.
-- Do NOT modify existing drivers. Do NOT auto-create bindings. Do NOT redesign cockpit.

-- =============================================================================
-- 1) TABLE: public.requirement_role_rules
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.requirement_role_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  role text NOT NULL,
  requirement_code text NOT NULL,
  requirement_name text NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, role, requirement_code)
);

COMMENT ON TABLE public.requirement_role_rules IS 'Role-to-requirement assignment rules (read-only enforcement). Mandatory rules surface as ILLEGAL+MISSING_REQUIRED in v_employee_requirement_status when employee has no binding.';

CREATE INDEX IF NOT EXISTS idx_requirement_role_rules_org_role
  ON public.requirement_role_rules(org_id, role);

CREATE INDEX IF NOT EXISTS idx_requirement_role_rules_org_code
  ON public.requirement_role_rules(org_id, requirement_code);

CREATE OR REPLACE FUNCTION public.set_requirement_role_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirement_role_rules_updated_at ON public.requirement_role_rules;
CREATE TRIGGER requirement_role_rules_updated_at
  BEFORE UPDATE ON public.requirement_role_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_requirement_role_rules_updated_at();

-- =============================================================================
-- 2) RLS
-- =============================================================================
ALTER TABLE public.requirement_role_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requirement_role_rules_select" ON public.requirement_role_rules;
CREATE POLICY "requirement_role_rules_select" ON public.requirement_role_rules
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "requirement_role_rules_insert" ON public.requirement_role_rules;
CREATE POLICY "requirement_role_rules_insert" ON public.requirement_role_rules
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "requirement_role_rules_update" ON public.requirement_role_rules;
CREATE POLICY "requirement_role_rules_update" ON public.requirement_role_rules
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "requirement_role_rules_delete" ON public.requirement_role_rules;
CREATE POLICY "requirement_role_rules_delete" ON public.requirement_role_rules
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_role_rules TO authenticated;

-- =============================================================================
-- 3) EXTEND VIEW: v_employee_requirement_status (bindings + synthetic MISSING_REQUIRED rows)
-- One row per (employee_id, requirement_code): existing binding OR missing mandatory rule.
-- Employee role resolved via employee_roles + roles (roles.code = rule.role).
-- =============================================================================
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

GRANT SELECT ON public.v_employee_requirement_status TO authenticated;
