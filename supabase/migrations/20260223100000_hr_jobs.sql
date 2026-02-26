-- HR Jobs: document jobs created from templates + employee (for PDF generation).
-- RLS: org members SELECT; admin/hr INSERT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.hr_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.hr_templates(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT '',
  rendered_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'CREATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_jobs_org ON public.hr_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_jobs_created_at ON public.hr_jobs(created_at DESC);

ALTER TABLE public.hr_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_jobs_select" ON public.hr_jobs;
CREATE POLICY "hr_jobs_select" ON public.hr_jobs
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_jobs_insert" ON public.hr_jobs;
CREATE POLICY "hr_jobs_insert" ON public.hr_jobs
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_jobs_update" ON public.hr_jobs;
CREATE POLICY "hr_jobs_update" ON public.hr_jobs
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_jobs_delete" ON public.hr_jobs;
CREATE POLICY "hr_jobs_delete" ON public.hr_jobs
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_jobs TO authenticated;
