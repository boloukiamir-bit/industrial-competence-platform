-- Create hr_task_resolutions table for audit trail of resolved HR tasks
-- Tracks when HR admins resolve or snooze expiring medical checks and certificates

CREATE TABLE IF NOT EXISTS public.hr_task_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_source text NOT NULL CHECK (task_source IN ('medical_check', 'certificate')),
  task_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('resolved', 'snoozed')),
  note text,
  resolved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, task_source, task_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_hr_task_resolutions_org ON public.hr_task_resolutions(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_task_resolutions_task ON public.hr_task_resolutions(org_id, task_source, task_id);
CREATE INDEX IF NOT EXISTS idx_hr_task_resolutions_resolved_by ON public.hr_task_resolutions(resolved_by);
CREATE INDEX IF NOT EXISTS idx_hr_task_resolutions_status ON public.hr_task_resolutions(org_id, status);

-- Enable RLS
ALTER TABLE public.hr_task_resolutions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: HR admins can read/write their org's resolutions
CREATE POLICY hr_task_resolutions_select ON public.hr_task_resolutions
  FOR SELECT USING (public.is_org_admin(org_id));

CREATE POLICY hr_task_resolutions_insert ON public.hr_task_resolutions
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY hr_task_resolutions_update ON public.hr_task_resolutions
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY hr_task_resolutions_delete ON public.hr_task_resolutions
  FOR DELETE USING (public.is_org_admin(org_id));
