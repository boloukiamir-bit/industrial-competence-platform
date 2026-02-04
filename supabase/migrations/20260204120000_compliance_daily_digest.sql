-- P1.9 Compliance Daily Digest: store daily HR digest per org/site for cron + UI.
-- RLS: SELECT is_org_member; INSERT is_org_admin_or_hr (cron uses service role and bypasses RLS).

CREATE TABLE IF NOT EXISTS public.compliance_daily_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  digest_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_compliance_daily_digests_org_site_date
  ON public.compliance_daily_digests (org_id, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid), digest_date);

CREATE INDEX IF NOT EXISTS idx_compliance_daily_digests_org_date
  ON public.compliance_daily_digests (org_id, digest_date DESC);

ALTER TABLE public.compliance_daily_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_daily_digests_select" ON public.compliance_daily_digests;
CREATE POLICY "compliance_daily_digests_select" ON public.compliance_daily_digests
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "compliance_daily_digests_insert" ON public.compliance_daily_digests;
CREATE POLICY "compliance_daily_digests_insert" ON public.compliance_daily_digests
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT ON public.compliance_daily_digests TO authenticated;
