-- P1.1 Recommended Actions Autopop: idempotency for open actions.
-- One open action per (org, site, employee, compliance, action_type).
-- COALESCE(site_id, ...) so NULL site_id is treated as one sentinel for uniqueness.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_compliance_actions_open_per_scope
  ON public.compliance_actions (
    org_id,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    employee_id,
    compliance_id,
    action_type
  )
  WHERE status = 'open';
