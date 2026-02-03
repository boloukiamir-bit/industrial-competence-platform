-- P0.8.1 Site-Scoping Hardening: backfill site_id from employees; no global NOT NULL.
-- Enforcement: API sets site_id on create and filters strictly when activeSiteId is set.

-- Backfill: set site_id from employee where action has null site_id and employee has site_id
UPDATE public.compliance_actions a
SET site_id = e.site_id
FROM public.employees e
WHERE a.site_id IS NULL
  AND a.employee_id = e.id
  AND a.org_id = e.org_id
  AND e.site_id IS NOT NULL;

-- Optional index to support strict site filtering on list
CREATE INDEX IF NOT EXISTS idx_compliance_actions_org_employee_site
  ON public.compliance_actions(org_id, employee_id, site_id);
