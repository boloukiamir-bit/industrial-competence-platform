-- Ensure wf_template_steps has default_due_days (legacy workflow system).
-- Fixes "column default_due_days does not exist" on /app/workflows/templates.

ALTER TABLE public.wf_template_steps
  ADD COLUMN IF NOT EXISTS default_due_days integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.wf_template_steps.default_due_days IS 'Default number of days from instance start for this step due date';
