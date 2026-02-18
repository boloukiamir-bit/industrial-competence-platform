-- HR Workflow Engine v1: trigger-driven, tenant-isolated.
-- Extends hr_workflows/hr_workflow_steps; adds hr_employee_workflows + hr_employee_steps.
-- Future: ai_rule_json for AI auto-evaluation.

-- =============================================================================
-- 1) hr_workflows: add category, trigger_type, role_scope, ai_rule_json
-- =============================================================================
ALTER TABLE public.hr_workflows
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS trigger_type text,
  ADD COLUMN IF NOT EXISTS role_scope text,
  ADD COLUMN IF NOT EXISTS ai_rule_json jsonb;

COMMENT ON COLUMN public.hr_workflows.category IS 'employment, onboarding, compliance, offboarding';
COMMENT ON COLUMN public.hr_workflows.trigger_type IS 'manual, on_employee_created, on_role_assigned, on_contract_end, on_expiry';
COMMENT ON COLUMN public.hr_workflows.role_scope IS 'Optional role filter for auto-assignment; null = any role';
COMMENT ON COLUMN public.hr_workflows.ai_rule_json IS 'Future: AI auto-evaluation rules';

-- =============================================================================
-- 2) hr_workflow_steps: add step_type, order_index (align with spec)
-- =============================================================================
ALTER TABLE public.hr_workflow_steps
  ADD COLUMN IF NOT EXISTS step_type text,
  ADD COLUMN IF NOT EXISTS order_index int;

UPDATE public.hr_workflow_steps SET order_index = step_order WHERE order_index IS NULL;
CREATE INDEX IF NOT EXISTS idx_hr_workflow_steps_order ON public.hr_workflow_steps(workflow_id, order_index);

-- =============================================================================
-- 3) hr_employee_workflows (instance per employee)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hr_employee_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.hr_workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employee_workflows_employee_workflow
  ON public.hr_employee_workflows(org_id, employee_id, workflow_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_hr_employee_workflows_org_site ON public.hr_employee_workflows(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_workflows_employee ON public.hr_employee_workflows(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_workflows_status ON public.hr_employee_workflows(status);

ALTER TABLE public.hr_employee_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_employee_workflows_select" ON public.hr_employee_workflows;
CREATE POLICY "hr_employee_workflows_select" ON public.hr_employee_workflows
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_employee_workflows_insert" ON public.hr_employee_workflows;
CREATE POLICY "hr_employee_workflows_insert" ON public.hr_employee_workflows
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_employee_workflows_update" ON public.hr_employee_workflows;
CREATE POLICY "hr_employee_workflows_update" ON public.hr_employee_workflows
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_employee_workflows_delete" ON public.hr_employee_workflows;
CREATE POLICY "hr_employee_workflows_delete" ON public.hr_employee_workflows
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_workflows TO authenticated;

-- =============================================================================
-- 4) hr_employee_steps (instance step status)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hr_employee_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.hr_workflows(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.hr_workflow_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'waived', 'blocked')),
  due_date date,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, workflow_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_steps_org_site ON public.hr_employee_steps(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_steps_employee ON public.hr_employee_steps(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_steps_workflow ON public.hr_employee_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_steps_status_due ON public.hr_employee_steps(status, due_date);

ALTER TABLE public.hr_employee_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_employee_steps_select" ON public.hr_employee_steps;
CREATE POLICY "hr_employee_steps_select" ON public.hr_employee_steps
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_employee_steps_insert" ON public.hr_employee_steps;
CREATE POLICY "hr_employee_steps_insert" ON public.hr_employee_steps
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_employee_steps_update" ON public.hr_employee_steps;
CREATE POLICY "hr_employee_steps_update" ON public.hr_employee_steps
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_employee_steps_delete" ON public.hr_employee_steps;
CREATE POLICY "hr_employee_steps_delete" ON public.hr_employee_steps
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_steps TO authenticated;

COMMENT ON TABLE public.hr_employee_workflows IS 'HR Workflow Engine v1: one row per employee workflow instance';
COMMENT ON TABLE public.hr_employee_steps IS 'HR Workflow Engine v1: step status per employee workflow instance';
