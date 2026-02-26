-- Requirement applicability: which employees a compliance requirement applies to (by line, role, or globally).
-- If no row exists for a compliance_id, treat as applies_globally = true (backward compatible).

CREATE TABLE IF NOT EXISTS public.compliance_requirement_applicability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  compliance_id uuid NOT NULL REFERENCES public.compliance_catalog(id) ON DELETE CASCADE,
  applies_to_line text NULL,
  applies_to_role text NULL,
  applies_globally boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_applicability_org_compliance
  ON public.compliance_requirement_applicability(org_id, compliance_id);

ALTER TABLE public.compliance_requirement_applicability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_requirement_applicability_select" ON public.compliance_requirement_applicability;
CREATE POLICY "compliance_requirement_applicability_select" ON public.compliance_requirement_applicability
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "compliance_requirement_applicability_insert" ON public.compliance_requirement_applicability;
CREATE POLICY "compliance_requirement_applicability_insert" ON public.compliance_requirement_applicability
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_requirement_applicability_update" ON public.compliance_requirement_applicability;
CREATE POLICY "compliance_requirement_applicability_update" ON public.compliance_requirement_applicability
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_requirement_applicability_delete" ON public.compliance_requirement_applicability;
CREATE POLICY "compliance_requirement_applicability_delete" ON public.compliance_requirement_applicability
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_requirement_applicability TO authenticated;

COMMENT ON TABLE public.compliance_requirement_applicability IS 'Scopes compliance requirements to line/role; no rows for a compliance_id means applies globally.';
