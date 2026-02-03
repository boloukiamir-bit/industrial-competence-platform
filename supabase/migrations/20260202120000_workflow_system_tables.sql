-- Workflow system tables (workflow_templates, workflow_template_steps, workflows, workflow_steps)
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY.
-- RLS: org members read; admin/hr write. Reuses is_org_member, is_org_admin_or_hr when present.

-- ============================================================================
-- 1) workflow_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Production', 'Safety', 'HR', 'Quality', 'Maintenance', 'Competence',
    'Onboarding', 'Offboarding', 'Medical', 'Contract'
  )),
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_templates_org_name
  ON public.workflow_templates (org_id, name);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_org
  ON public.workflow_templates (org_id);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_templates_select" ON public.workflow_templates;
CREATE POLICY "workflow_templates_select" ON public.workflow_templates
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "workflow_templates_insert" ON public.workflow_templates;
CREATE POLICY "workflow_templates_insert" ON public.workflow_templates
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflow_templates_update" ON public.workflow_templates;
CREATE POLICY "workflow_templates_update" ON public.workflow_templates
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflow_templates_delete" ON public.workflow_templates;
CREATE POLICY "workflow_templates_delete" ON public.workflow_templates
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- 2) workflow_template_steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  title text NOT NULL,
  description text NULL,
  owner_role text NULL,
  due_days int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_workflow_template_steps_template
  ON public.workflow_template_steps (template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_steps_org
  ON public.workflow_template_steps (org_id);

ALTER TABLE public.workflow_template_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_template_steps_select" ON public.workflow_template_steps;
CREATE POLICY "workflow_template_steps_select" ON public.workflow_template_steps
  FOR SELECT USING (
    public.is_org_member(org_id)
  );

DROP POLICY IF EXISTS "workflow_template_steps_insert" ON public.workflow_template_steps;
CREATE POLICY "workflow_template_steps_insert" ON public.workflow_template_steps
  FOR INSERT WITH CHECK (
    public.is_org_admin_or_hr(org_id)
  );

DROP POLICY IF EXISTS "workflow_template_steps_update" ON public.workflow_template_steps;
CREATE POLICY "workflow_template_steps_update" ON public.workflow_template_steps
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflow_template_steps_delete" ON public.workflow_template_steps;
CREATE POLICY "workflow_template_steps_delete" ON public.workflow_template_steps
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- 3) workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  template_id uuid NULL REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  title text NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  due_at timestamptz NULL,
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_org_employee_status
  ON public.workflows (org_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_workflows_org
  ON public.workflows (org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_template
  ON public.workflows (template_id);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflows_select" ON public.workflows;
CREATE POLICY "workflows_select" ON public.workflows
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "workflows_insert" ON public.workflows;
CREATE POLICY "workflows_insert" ON public.workflows
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflows_update" ON public.workflows;
CREATE POLICY "workflows_update" ON public.workflows
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflows_delete" ON public.workflows;
CREATE POLICY "workflows_delete" ON public.workflows
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- 4) workflow_steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  owner_user_id uuid NULL,
  due_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text NULL,
  UNIQUE (workflow_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow
  ON public.workflow_steps (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_org
  ON public.workflow_steps (org_id);

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_steps_select" ON public.workflow_steps;
CREATE POLICY "workflow_steps_select" ON public.workflow_steps
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "workflow_steps_insert" ON public.workflow_steps;
CREATE POLICY "workflow_steps_insert" ON public.workflow_steps
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflow_steps_update" ON public.workflow_steps;
CREATE POLICY "workflow_steps_update" ON public.workflow_steps
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "workflow_steps_delete" ON public.workflow_steps;
CREATE POLICY "workflow_steps_delete" ON public.workflow_steps
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- Grants (authenticated + service_role)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_steps TO authenticated;
GRANT ALL ON public.workflow_template_steps TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT ALL ON public.workflow_steps TO service_role;

-- ============================================================================
-- Notify PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';
