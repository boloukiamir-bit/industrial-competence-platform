-- Training tasks from Cockpit "Plan training" and other sources.
-- Stores: org_id, site_id, source_decision_id (cockpit issue/decision link), template (workflow), title, owner, due_date, status, created_by.

CREATE TABLE IF NOT EXISTS public.hr_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.sites(id) ON DELETE SET NULL,
  source_decision_id text NULL,
  template_id uuid NOT NULL REFERENCES public.hr_workflows(id) ON DELETE CASCADE,
  title text NOT NULL,
  owner_role text NOT NULL DEFAULT 'HR' CHECK (owner_role IN ('Ops', 'Supervisor', 'HR')),
  owner_id uuid NULL REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_tasks_org ON public.hr_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_tasks_status ON public.hr_tasks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_tasks_due ON public.hr_tasks(org_id, due_date);

ALTER TABLE public.hr_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_tasks_select" ON public.hr_tasks;
CREATE POLICY "hr_tasks_select" ON public.hr_tasks
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_tasks_insert" ON public.hr_tasks;
CREATE POLICY "hr_tasks_insert" ON public.hr_tasks
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_tasks_update" ON public.hr_tasks;
CREATE POLICY "hr_tasks_update" ON public.hr_tasks
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_tasks_delete" ON public.hr_tasks;
CREATE POLICY "hr_tasks_delete" ON public.hr_tasks
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_tasks TO authenticated;
