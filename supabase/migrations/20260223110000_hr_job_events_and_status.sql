-- HR Job lifecycle: status constraint + audit event log.
-- Multi-tenant: org_id on events; RLS follows existing org member / admin-or-hr patterns.

-- 1) Constrain hr_jobs.status to allowed values
ALTER TABLE public.hr_jobs
  DROP CONSTRAINT IF EXISTS hr_jobs_status_check;
ALTER TABLE public.hr_jobs
  ADD CONSTRAINT hr_jobs_status_check CHECK (
    status IN ('CREATED', 'SENT', 'SIGNED', 'COMPLETED', 'CANCELLED')
  );

-- 2) hr_job_events: audit log for status changes and PDF generation
CREATE TABLE IF NOT EXISTS public.hr_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  job_id uuid NOT NULL REFERENCES public.hr_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text NULL,
  to_status text NULL,
  actor_user_id uuid NULL,
  actor_email text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_job_events_org_job_created
  ON public.hr_job_events(org_id, job_id, created_at DESC);

ALTER TABLE public.hr_job_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_job_events_select" ON public.hr_job_events;
CREATE POLICY "hr_job_events_select" ON public.hr_job_events
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_job_events_insert" ON public.hr_job_events;
CREATE POLICY "hr_job_events_insert" ON public.hr_job_events
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT ON public.hr_job_events TO authenticated;
