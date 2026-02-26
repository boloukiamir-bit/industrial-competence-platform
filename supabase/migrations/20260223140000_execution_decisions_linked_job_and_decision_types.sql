-- execution_decisions: linked_job_id (optional FK to hr_jobs) and decision_type values for cockpit (ACKNOWLEDGED, OVERRIDDEN, DEFERRED, RESOLVED).

ALTER TABLE public.execution_decisions
  ADD COLUMN IF NOT EXISTS linked_job_id uuid NULL REFERENCES public.hr_jobs(id) ON DELETE SET NULL;
