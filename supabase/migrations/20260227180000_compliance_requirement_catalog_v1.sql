-- Compliance Requirement Catalog v1: tenant-safe catalog for standard requirements.
-- Table: public.compliance_requirements; View: v_active_compliance_requirements (optional).
-- No driver refactors. No cockpit redesign.

-- =============================================================================
-- 1) TABLE: public.compliance_requirements
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  UNIQUE (org_id, code)
);

COMMENT ON TABLE public.compliance_requirements IS 'Org-scoped catalog of standard compliance requirements. V1: used by HR Inbox requirement binding drawer.';

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_org_active
  ON public.compliance_requirements(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_org_category
  ON public.compliance_requirements(org_id, category);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_compliance_requirements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compliance_requirements_updated_at ON public.compliance_requirements;
CREATE TRIGGER compliance_requirements_updated_at
  BEFORE UPDATE ON public.compliance_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_compliance_requirements_updated_at();

-- =============================================================================
-- 2) RLS
-- =============================================================================
ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_requirements_select" ON public.compliance_requirements;
CREATE POLICY "compliance_requirements_select" ON public.compliance_requirements
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "compliance_requirements_insert" ON public.compliance_requirements;
CREATE POLICY "compliance_requirements_insert" ON public.compliance_requirements
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_requirements_update" ON public.compliance_requirements;
CREATE POLICY "compliance_requirements_update" ON public.compliance_requirements
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_requirements_delete" ON public.compliance_requirements;
CREATE POLICY "compliance_requirements_delete" ON public.compliance_requirements
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_requirements TO authenticated;

-- =============================================================================
-- 3) VIEW: v_active_compliance_requirements (optional)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_active_compliance_requirements AS
SELECT id, org_id, site_id, code, name, category, description, created_at, updated_at
FROM public.compliance_requirements
WHERE is_active = true;

COMMENT ON VIEW public.v_active_compliance_requirements IS 'Active catalog entries only. Use for dropdowns and pickers.';
