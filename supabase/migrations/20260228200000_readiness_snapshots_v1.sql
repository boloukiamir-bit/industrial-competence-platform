-- Readiness Snapshot (Execution Freeze) v1: audit-proof storage for shift readiness + IRI.
-- RLS: org-scoped (read = is_org_member, insert = is_org_member for cockpit trigger).

CREATE TABLE IF NOT EXISTS public.readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  shift_code text NOT NULL,
  legal_flag text NOT NULL,
  ops_flag text NOT NULL,
  overall_status text NOT NULL,
  iri_score integer NOT NULL,
  iri_grade text NOT NULL,
  roster_employee_count integer NOT NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_org_shift
  ON public.readiness_snapshots(org_id, shift_date, shift_code);
CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_created_at
  ON public.readiness_snapshots(org_id, created_at DESC);

COMMENT ON TABLE public.readiness_snapshots IS 'Execution freeze: immutable snapshot of readiness-v3 + IRI_V1 for audit.';

ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "readiness_snapshots_select" ON public.readiness_snapshots;
CREATE POLICY "readiness_snapshots_select" ON public.readiness_snapshots
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "readiness_snapshots_insert" ON public.readiness_snapshots;
CREATE POLICY "readiness_snapshots_insert" ON public.readiness_snapshots
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
