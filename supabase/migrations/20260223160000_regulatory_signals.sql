-- Regulatory Radar storage: regulatory_signals table.
-- RLS: org members SELECT/INSERT/UPDATE; DELETE disallowed. No UI. No auto-linking to compliance.

CREATE TABLE IF NOT EXISTS public.regulatory_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.sites(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('AUTO', 'MANUAL')),
  impact_level text NOT NULL CHECK (impact_level IN ('LOW', 'MEDIUM', 'HIGH')),
  title text NOT NULL,
  summary text NULL,
  source_name text NULL,
  source_url text NULL,
  effective_date date NULL,
  time_to_impact_days int NULL,
  relevance_score int NOT NULL DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 100),
  dismissed boolean NOT NULL DEFAULT false,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Main list/filter index: org, dismissed, impact, relevance desc, created desc
CREATE INDEX IF NOT EXISTS idx_regulatory_signals_org_dismissed_impact_relevance
  ON public.regulatory_signals (org_id, dismissed, impact_level, relevance_score DESC, created_at DESC);

-- Org/site lookup
CREATE INDEX IF NOT EXISTS idx_regulatory_signals_org_site
  ON public.regulatory_signals (org_id, site_id);

-- Prevent duplicate AUTO signals by source_url + effective_date
CREATE UNIQUE INDEX IF NOT EXISTS uniq_regulatory_signals_auto_source
  ON public.regulatory_signals (org_id, source_url, effective_date)
  WHERE source_type = 'AUTO' AND source_url IS NOT NULL;

-- updated_at trigger (reuse public.set_updated_at from 20260203170000)
DROP TRIGGER IF EXISTS trg_regulatory_signals_updated_at ON public.regulatory_signals;
CREATE TRIGGER trg_regulatory_signals_updated_at
  BEFORE UPDATE ON public.regulatory_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.regulatory_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regulatory_signals_select" ON public.regulatory_signals;
CREATE POLICY "regulatory_signals_select" ON public.regulatory_signals
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "regulatory_signals_insert" ON public.regulatory_signals;
CREATE POLICY "regulatory_signals_insert" ON public.regulatory_signals
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "regulatory_signals_update" ON public.regulatory_signals;
CREATE POLICY "regulatory_signals_update" ON public.regulatory_signals
  FOR UPDATE USING (public.is_org_member(org_id));

-- DELETE disallowed (no policy; RLS denies by default)

GRANT SELECT, INSERT, UPDATE ON public.regulatory_signals TO authenticated;

COMMENT ON TABLE public.regulatory_signals IS 'Regulatory Radar signals; org members read/write; DELETE disallowed.';
