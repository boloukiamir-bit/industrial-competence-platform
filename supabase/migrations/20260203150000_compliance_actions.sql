-- P0.8 Action Gravity: actionable items per employee/compliance without workflow engine.
-- RLS: org members read; admin/hr insert/update. Tenant: org_id + optional site_id.

CREATE TABLE IF NOT EXISTS public.compliance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  compliance_id uuid NOT NULL REFERENCES public.compliance_catalog(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'request_renewal',
    'request_evidence',
    'notify_employee',
    'mark_waived_review'
  )),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  owner_user_id uuid,
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_actions_org_status
  ON public.compliance_actions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_org_employee
  ON public.compliance_actions(org_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_org_compliance
  ON public.compliance_actions(org_id, compliance_id);

ALTER TABLE public.compliance_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_actions_select" ON public.compliance_actions;
CREATE POLICY "compliance_actions_select" ON public.compliance_actions
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "compliance_actions_insert" ON public.compliance_actions;
CREATE POLICY "compliance_actions_insert" ON public.compliance_actions
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_actions_update" ON public.compliance_actions;
CREATE POLICY "compliance_actions_update" ON public.compliance_actions
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE ON public.compliance_actions TO authenticated;
