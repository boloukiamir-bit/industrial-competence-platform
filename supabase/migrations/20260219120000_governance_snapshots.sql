-- Phase A: immutable governance_snapshots per gate evaluation; governance_events links via snapshot_id.

CREATE TABLE IF NOT EXISTS public.governance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NULL,
  scope text NOT NULL,
  shift_id uuid NULL,
  shift_date date NULL,
  shift_code text NULL,
  legitimacy_status text NOT NULL,
  readiness_status text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  policy_fingerprint text NULL,
  calculated_at timestamptz NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.governance_snapshots IS 'Immutable snapshot of readiness/policy state for each gate evaluation (ALLOWED or BLOCKED).';
COMMENT ON COLUMN public.governance_snapshots.scope IS '"org" or "shift".';
COMMENT ON COLUMN public.governance_snapshots.payload IS 'Canonical snapshot: legitimacy_status, readiness_status, reason_codes, policy_fingerprint, policy, blocking_stations, readiness_score.';

CREATE INDEX IF NOT EXISTS idx_governance_snapshots_org_created
  ON public.governance_snapshots (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_snapshots_org_policy_fingerprint
  ON public.governance_snapshots (org_id, policy_fingerprint);

CREATE INDEX IF NOT EXISTS idx_governance_snapshots_org_scope_created
  ON public.governance_snapshots (org_id, scope, created_at DESC);

ALTER TABLE public.governance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS governance_snapshots_select_org ON public.governance_snapshots;
CREATE POLICY governance_snapshots_select_org
  ON public.governance_snapshots
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT: service role only (no authenticated insert policy).

ALTER TABLE public.governance_events
  ADD COLUMN IF NOT EXISTS snapshot_id uuid NULL REFERENCES public.governance_snapshots(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.governance_events.snapshot_id IS 'Links to governance_snapshots row for this evaluation; null if snapshot insert failed.';

CREATE INDEX IF NOT EXISTS idx_governance_events_org_snapshot_id
  ON public.governance_events (org_id, snapshot_id);
