-- HR Template Jobs: delegatable jobs from templates with PDF export.
-- Templates: use existing public.hr_templates. Seed 3 specific templates.

CREATE TABLE IF NOT EXISTS public.hr_template_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.sites(id) ON DELETE SET NULL,
  template_code text NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  owner_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
  due_date date NULL,
  notes text NULL,
  filled_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_template_jobs_org_site_status ON public.hr_template_jobs(org_id, site_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_template_jobs_org_employee ON public.hr_template_jobs(org_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_template_jobs_org_template ON public.hr_template_jobs(org_id, template_code);

ALTER TABLE public.hr_template_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_template_jobs_select" ON public.hr_template_jobs;
CREATE POLICY "hr_template_jobs_select" ON public.hr_template_jobs
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_template_jobs_insert" ON public.hr_template_jobs;
CREATE POLICY "hr_template_jobs_insert" ON public.hr_template_jobs
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_template_jobs_update" ON public.hr_template_jobs;
CREATE POLICY "hr_template_jobs_update" ON public.hr_template_jobs
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_template_jobs_delete" ON public.hr_template_jobs;
CREATE POLICY "hr_template_jobs_delete" ON public.hr_template_jobs
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_template_jobs TO authenticated;

-- Seed 3 templates for delegatable jobs (all orgs, idempotent by org_id, code)
INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'MED-001',
  'Medical Fitness Clearance',
  'medical',
  '{"description":"Confirm medical fitness for work.","sections":[{"title":"Employee Details","fields":["name","employee_number","line","area"]},{"title":"Medical Declaration","fields":["fit_for_duty","restrictions","notes"]}]}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'CUST-IKEA-001',
  'IKEA Business Ethics Acknowledgement',
  'contract',
  '{"description":"Employee acknowledges IKEA Business Ethics principles.","sections":[{"title":"Acknowledgement","fields":["acknowledged","date","signature"]}]}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'SAF-CORE-001',
  'Fire Safety & First Aid Certification',
  'safety',
  '{"description":"Fire safety and first aid training completion.","sections":[{"title":"Certification","fields":["completed_date","valid_until","instructor"]}]}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();
