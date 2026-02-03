-- P1.2 Ownership & SLA: index for inbox filters (org, status, owner, due).
CREATE INDEX IF NOT EXISTS idx_compliance_actions_org_status_owner_due
  ON public.compliance_actions(org_id, status, owner_user_id, due_date);
