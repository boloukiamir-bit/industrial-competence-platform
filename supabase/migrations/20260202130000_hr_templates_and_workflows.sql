-- HR pilot: hr_templates, hr_workflows, hr_workflow_steps, employee_hr_step_status.
-- RLS: org members SELECT; admin/hr INSERT/UPDATE/DELETE (is_org_member, is_org_admin_or_hr).
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY.

-- ============================================================================
-- 1) hr_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hr_templates_org ON public.hr_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_templates_org_category ON public.hr_templates(org_id, category);

ALTER TABLE public.hr_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_templates_select" ON public.hr_templates;
CREATE POLICY "hr_templates_select" ON public.hr_templates
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_templates_insert" ON public.hr_templates;
CREATE POLICY "hr_templates_insert" ON public.hr_templates
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_templates_update" ON public.hr_templates;
CREATE POLICY "hr_templates_update" ON public.hr_templates
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_templates_delete" ON public.hr_templates;
CREATE POLICY "hr_templates_delete" ON public.hr_templates
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- 2) hr_workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hr_workflows_org ON public.hr_workflows(org_id);

ALTER TABLE public.hr_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_workflows_select" ON public.hr_workflows;
CREATE POLICY "hr_workflows_select" ON public.hr_workflows
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_workflows_insert" ON public.hr_workflows;
CREATE POLICY "hr_workflows_insert" ON public.hr_workflows
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_workflows_update" ON public.hr_workflows;
CREATE POLICY "hr_workflows_update" ON public.hr_workflows
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_workflows_delete" ON public.hr_workflows;
CREATE POLICY "hr_workflows_delete" ON public.hr_workflows
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- 3) hr_workflow_steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.hr_workflows(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  default_due_days int NULL,
  required boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, workflow_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hr_workflow_steps_workflow ON public.hr_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_hr_workflow_steps_org ON public.hr_workflow_steps(org_id);

ALTER TABLE public.hr_workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_workflow_steps_select" ON public.hr_workflow_steps;
CREATE POLICY "hr_workflow_steps_select" ON public.hr_workflow_steps
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_workflow_steps_insert" ON public.hr_workflow_steps;
CREATE POLICY "hr_workflow_steps_insert" ON public.hr_workflow_steps
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_workflow_steps_update" ON public.hr_workflow_steps;
CREATE POLICY "hr_workflow_steps_update" ON public.hr_workflow_steps
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_workflow_steps_delete" ON public.hr_workflow_steps;
CREATE POLICY "hr_workflow_steps_delete" ON public.hr_workflow_steps
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- 4) employee_hr_step_status
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_hr_step_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.hr_workflows(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.hr_workflow_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'waived')),
  due_date date NULL,
  completed_at timestamptz NULL,
  notes text NULL,
  evidence_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_hr_step_status_org ON public.employee_hr_step_status(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_hr_step_status_employee ON public.employee_hr_step_status(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_hr_step_status_workflow ON public.employee_hr_step_status(workflow_id);

ALTER TABLE public.employee_hr_step_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_hr_step_status_select" ON public.employee_hr_step_status;
CREATE POLICY "employee_hr_step_status_select" ON public.employee_hr_step_status
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_hr_step_status_insert" ON public.employee_hr_step_status;
CREATE POLICY "employee_hr_step_status_insert" ON public.employee_hr_step_status
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_hr_step_status_update" ON public.employee_hr_step_status;
CREATE POLICY "employee_hr_step_status_update" ON public.employee_hr_step_status
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_hr_step_status_delete" ON public.employee_hr_step_status;
CREATE POLICY "employee_hr_step_status_delete" ON public.employee_hr_step_status
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- ============================================================================
-- Grants
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflow_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_hr_step_status TO authenticated;

-- ============================================================================
-- Seed (idempotent): Spaljisten org – templates + workflows + steps
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
  w_onb_id uuid;
  w_off_id uuid;
  w_safety_id uuid;
  w_medical_id uuid;
  s_contract_signed_id uuid;
  s_id_card_id uuid;
  s_safety_intro_id uuid;
  s_system_access_id uuid;
  s_medical_check_id uuid;
  s_return_badge_id uuid;
  s_revoke_access_id uuid;
  s_exit_interview_id uuid;
  s_final_payroll_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Templates (INSERT ... ON CONFLICT DO NOTHING by code)
  INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
  VALUES
    (v_org_id, 'ONBOARDING_BASIC', 'Onboarding basic', 'onboarding', '{"steps":["contract_signed","id_card","safety_intro","system_access","medical_check_if_required"]}'::jsonb, true),
    (v_org_id, 'OFFBOARDING_BASIC', 'Offboarding basic', 'offboarding', '{"steps":["return_badge","revoke_access","exit_interview","final_payroll"]}'::jsonb, true),
    (v_org_id, 'MEDICAL_CHECK', 'Medical check', 'medical', '{"steps":["medical_exam","documents"]}'::jsonb, true),
    (v_org_id, 'SAFETY_INTRO', 'Safety introduction', 'safety', '{"steps":["safety_tour","safety_rules"]}'::jsonb, true)
  ON CONFLICT (org_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  -- Workflows: ONBOARDING, OFFBOARDING, SAFETY_INTRO, MEDICAL_CHECK
  INSERT INTO public.hr_workflows (org_id, code, name, description, is_active)
  VALUES
    (v_org_id, 'ONBOARDING', 'Onboarding', 'Standard onboarding workflow', true),
    (v_org_id, 'OFFBOARDING', 'Offboarding', 'Standard offboarding workflow', true),
    (v_org_id, 'SAFETY_INTRO', 'Safety introduction', 'Safety introduction workflow', true),
    (v_org_id, 'MEDICAL_CHECK', 'Medical check', 'Medical check workflow', true)
  ON CONFLICT (org_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  SELECT id INTO w_onb_id FROM public.hr_workflows WHERE org_id = v_org_id AND code = 'ONBOARDING' LIMIT 1;
  SELECT id INTO w_off_id FROM public.hr_workflows WHERE org_id = v_org_id AND code = 'OFFBOARDING' LIMIT 1;
  SELECT id INTO w_safety_id FROM public.hr_workflows WHERE org_id = v_org_id AND code = 'SAFETY_INTRO' LIMIT 1;
  SELECT id INTO w_medical_id FROM public.hr_workflows WHERE org_id = v_org_id AND code = 'MEDICAL_CHECK' LIMIT 1;
  IF w_onb_id IS NULL OR w_off_id IS NULL THEN
    RETURN;
  END IF;

  -- ONBOARDING steps
  INSERT INTO public.hr_workflow_steps (org_id, workflow_id, step_order, code, name, description, default_due_days, required)
  VALUES
    (v_org_id, w_onb_id, 1, 'contract_signed', 'Contract signed', NULL, 1, true),
    (v_org_id, w_onb_id, 2, 'id_card', 'ID card', NULL, 3, true),
    (v_org_id, w_onb_id, 3, 'safety_intro', 'Safety intro', NULL, 7, true),
    (v_org_id, w_onb_id, 4, 'system_access', 'System access', NULL, 5, true),
    (v_org_id, w_onb_id, 5, 'medical_check_if_required', 'Medical check if required', NULL, 14, true)
  ON CONFLICT (org_id, workflow_id, code) DO UPDATE SET
    step_order = EXCLUDED.step_order,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_due_days = EXCLUDED.default_due_days,
    required = EXCLUDED.required;

  -- OFFBOARDING steps
  INSERT INTO public.hr_workflow_steps (org_id, workflow_id, step_order, code, name, description, default_due_days, required)
  VALUES
    (v_org_id, w_off_id, 1, 'return_badge', 'Return badge', NULL, 0, true),
    (v_org_id, w_off_id, 2, 'revoke_access', 'Revoke access', NULL, 0, true),
    (v_org_id, w_off_id, 3, 'exit_interview', 'Exit interview', NULL, 0, true),
    (v_org_id, w_off_id, 4, 'final_payroll', 'Final payroll', NULL, 30, true)
  ON CONFLICT (org_id, workflow_id, code) DO UPDATE SET
    step_order = EXCLUDED.step_order,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_due_days = EXCLUDED.default_due_days,
    required = EXCLUDED.required;

  -- SAFETY_INTRO steps (only if workflow exists)
  IF w_safety_id IS NOT NULL THEN
    INSERT INTO public.hr_workflow_steps (org_id, workflow_id, step_order, code, name, description, default_due_days, required)
    VALUES
      (v_org_id, w_safety_id, 1, 'safety_intro_done', 'Safety intro done', NULL, 7, true),
      (v_org_id, w_safety_id, 2, 'ppe_issued', 'PPE issued', NULL, 7, true),
      (v_org_id, w_safety_id, 3, 'emergency_briefing', 'Emergency briefing', NULL, 7, true)
    ON CONFLICT (org_id, workflow_id, code) DO UPDATE SET
      step_order = EXCLUDED.step_order,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      default_due_days = EXCLUDED.default_due_days,
      required = EXCLUDED.required;
  END IF;

  -- MEDICAL_CHECK steps (only if workflow exists)
  IF w_medical_id IS NOT NULL THEN
    INSERT INTO public.hr_workflow_steps (org_id, workflow_id, step_order, code, name, description, default_due_days, required)
    VALUES
      (v_org_id, w_medical_id, 1, 'booked', 'Booked', NULL, 14, true),
      (v_org_id, w_medical_id, 2, 'completed', 'Completed', NULL, 0, true),
      (v_org_id, w_medical_id, 3, 'fit_for_work', 'Fit for work', NULL, 0, true)
    ON CONFLICT (org_id, workflow_id, code) DO UPDATE SET
      step_order = EXCLUDED.step_order,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      default_due_days = EXCLUDED.default_due_days,
      required = EXCLUDED.required;
  END IF;

  RAISE NOTICE 'HR pilot seed: Spaljisten templates and workflows applied';
END;
$$;

NOTIFY pgrst, 'reload schema';
