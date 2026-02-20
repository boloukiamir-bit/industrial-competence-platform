-- Phase B: Compliance Matrix 2.0 – inheritance layer (ORG/ROLE/STATION bindings).
-- Deterministic compliance requirement bindings with explicit disables + overrides.
-- No UI changes. Writes via service role only.

-- =============================================================================
-- A) compliance_catalog – ensure table + minimum contract fields (schema-upgrade safe)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.compliance_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NULL,
  scope_type text NULL,
  validity_type text NOT NULL DEFAULT 'EXPIRY_DATE',
  default_validity_days int NULL,
  legal_blocking boolean NOT NULL DEFAULT true,
  default_warning_window_days int NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, code)
);

-- Add columns if missing on existing table (no-op if present).
ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS category text NULL;

ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS scope_type text NULL;

ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS validity_type text NOT NULL DEFAULT 'EXPIRY_DATE';

ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS default_validity_days int NULL;

ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS legal_blocking boolean NOT NULL DEFAULT true;

ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS default_warning_window_days int NOT NULL DEFAULT 30;

ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- =============================================================================
-- B) public.compliance_requirement_bindings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.compliance_requirement_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  role_id uuid NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  station_id uuid NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  compliance_code text NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  legal_blocking_override boolean NULL,
  warning_window_days_override int NULL,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_requirement_bindings_scope_check CHECK (
    (scope_type = 'ORG'   AND role_id IS NULL AND station_id IS NULL)
    OR (scope_type = 'ROLE'   AND role_id IS NOT NULL AND station_id IS NULL)
    OR (scope_type = 'STATION' AND station_id IS NOT NULL AND role_id IS NULL)
  ),
  UNIQUE (org_id, site_id, scope_type, role_id, station_id, compliance_code)
);

COMMENT ON TABLE public.compliance_requirement_bindings IS 'Compliance requirement bindings by ORG/ROLE/STATION with overrides and disables (inheritance layer).';
COMMENT ON COLUMN public.compliance_requirement_bindings.scope_type IS 'ORG | ROLE | STATION; constrains role_id/station_id via CHECK.';
COMMENT ON COLUMN public.compliance_requirement_bindings.compliance_code IS 'References compliance_catalog.code for easier imports.';
COMMENT ON COLUMN public.compliance_requirement_bindings.legal_blocking_override IS 'Override catalog legal_blocking; NULL = use catalog default.';
COMMENT ON COLUMN public.compliance_requirement_bindings.disabled IS 'When true, this binding is excluded from requirement resolution.';

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_bindings_org_scope
  ON public.compliance_requirement_bindings(org_id, scope_type);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_bindings_org_code
  ON public.compliance_requirement_bindings(org_id, compliance_code);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_bindings_org_role
  ON public.compliance_requirement_bindings(org_id, role_id);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_bindings_org_station
  ON public.compliance_requirement_bindings(org_id, station_id);

ALTER TABLE public.compliance_requirement_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_requirement_bindings_select_org ON public.compliance_requirement_bindings;
CREATE POLICY compliance_requirement_bindings_select_org
  ON public.compliance_requirement_bindings
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT/UPDATE: service role only (no policy for authenticated).

-- =============================================================================
-- C) Seed: minimal ORG-level bindings for Spaljisten (only if catalog codes exist)
-- =============================================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.compliance_requirement_bindings (
    org_id, site_id, scope_type, role_id, station_id, compliance_code, mandatory
  )
  SELECT v_org_id, NULL, 'ORG', NULL, NULL, cc.code, true
  FROM public.compliance_catalog cc
  WHERE cc.org_id = v_org_id
    AND cc.code IN ('SAFETY_INDUCTION', 'MEDICAL_FITNESS', 'FORKLIFT_LICENSE')
  ON CONFLICT (org_id, site_id, scope_type, role_id, station_id, compliance_code)
  DO UPDATE SET mandatory = EXCLUDED.mandatory;

  IF FOUND THEN
    RAISE NOTICE 'Phase B seed: Spaljisten ORG-level compliance bindings applied';
  END IF;
END;
$$;
