-- BCLEDGE Phase A: governance_events audit trail for legitimacy enforcement.
-- gen_random_uuid() is available in core PostgreSQL 13+ (no pgcrypto required).

CREATE TABLE IF NOT EXISTS public.governance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NULL,
  actor_user_id uuid NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NULL,
  outcome text NOT NULL,
  legitimacy_status text NOT NULL,
  readiness_status text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.governance_events IS 'Audit trail for governance gate: ALLOWED/BLOCKED attempts (e.g. COCKPIT_DECISION_CREATE).';

CREATE INDEX IF NOT EXISTS idx_governance_events_org_created
  ON public.governance_events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_events_org_action_created
  ON public.governance_events (org_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_events_org_outcome_created
  ON public.governance_events (org_id, outcome, created_at DESC);

ALTER TABLE public.governance_events ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users see only rows for their active org.
DROP POLICY IF EXISTS governance_events_select_org ON public.governance_events;
CREATE POLICY governance_events_select_org
  ON public.governance_events
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT: no policy for authenticated; app uses service role (bypasses RLS) to insert.
-- Thus only service role can insert.
