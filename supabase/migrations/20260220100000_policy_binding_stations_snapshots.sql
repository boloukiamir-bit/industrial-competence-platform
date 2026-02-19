-- Policy binding: station->unit for policy resolution; audit snapshots per shift.
-- STRATEGY_LOCK Phase A – unit-level policy binding.

-- =============================================================================
-- 1) stations: add org_unit_id (unit-level policy binding)
-- =============================================================================
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stations_org_unit_id ON public.stations(org_unit_id);

COMMENT ON COLUMN public.stations.org_unit_id IS 'Business unit for policy binding; required for LEGAL_STOP policy check.';

-- =============================================================================
-- 2) shift_policy_snapshots (audit: policy version + config used per shift/unit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shift_policy_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  industry_type text NOT NULL,
  version integer NOT NULL,
  config_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (shift_id, unit_id, version)
);

CREATE INDEX IF NOT EXISTS idx_shift_policy_snapshots_shift_id ON public.shift_policy_snapshots(shift_id);

COMMENT ON TABLE public.shift_policy_snapshots IS 'Audit: policy template version and config hash used per shift/unit for legitimacy.';
