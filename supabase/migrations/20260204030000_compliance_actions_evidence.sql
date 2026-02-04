-- P1.6 Evidence Links: store evidence URL + notes on compliance_actions; audit via events.

-- 1) Add evidence columns to compliance_actions
ALTER TABLE public.compliance_actions
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS evidence_notes text,
  ADD COLUMN IF NOT EXISTS evidence_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_added_by uuid;

CREATE INDEX IF NOT EXISTS idx_compliance_actions_org_evidence
  ON public.compliance_actions(org_id, evidence_added_at);

-- 2) Extend compliance_action_events.event_type to include 'evidence_added'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.compliance_action_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%event_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.compliance_action_events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.compliance_action_events
  ADD CONSTRAINT compliance_action_events_event_type_check
  CHECK (event_type IN ('draft_copied', 'evidence_added'));
