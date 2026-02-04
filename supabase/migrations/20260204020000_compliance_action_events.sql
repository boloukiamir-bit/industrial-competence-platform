-- P1.5 Draft History + Audit: log draft_copied events for compliance actions.
-- RLS: org members SELECT; org members INSERT (any user may copy drafts). No UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.compliance_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  action_id uuid NOT NULL REFERENCES public.compliance_actions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('draft_copied')),
  channel text CHECK (channel IN ('email', 'sms', 'note')),
  template_id uuid REFERENCES public.hr_templates(id) ON DELETE SET NULL,
  copied_title boolean NOT NULL DEFAULT false,
  copied_body boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_action_events_org_action_created
  ON public.compliance_action_events(org_id, action_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_action_events_org_created
  ON public.compliance_action_events(org_id, created_at DESC);

ALTER TABLE public.compliance_action_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_action_events_select" ON public.compliance_action_events;
CREATE POLICY "compliance_action_events_select" ON public.compliance_action_events
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "compliance_action_events_insert" ON public.compliance_action_events;
CREATE POLICY "compliance_action_events_insert" ON public.compliance_action_events
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

GRANT SELECT, INSERT ON public.compliance_action_events TO authenticated;
