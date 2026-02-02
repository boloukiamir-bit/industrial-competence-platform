-- Compliance & Competence pilot: unified catalog + per-employee compliance with validity/expiry.
-- Categories: license, medical, contract. Status computed server-side (valid/expiring/expired/missing/waived).
-- RLS: org members read; admin/hr write.

CREATE TABLE IF NOT EXISTS public.compliance_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  category text NOT NULL CHECK (category IN ('license','medical','contract')),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  default_validity_days int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_compliance_catalog_org ON public.compliance_catalog(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_catalog_category ON public.compliance_catalog(org_id, category);

CREATE TABLE IF NOT EXISTS public.employee_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  compliance_id uuid NOT NULL REFERENCES public.compliance_catalog(id) ON DELETE CASCADE,
  valid_from date,
  valid_to date,
  evidence_url text,
  notes text,
  waived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, compliance_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_compliance_org ON public.employee_compliance(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_compliance_employee ON public.employee_compliance(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_compliance_compliance ON public.employee_compliance(compliance_id);

ALTER TABLE public.compliance_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compliance ENABLE ROW LEVEL SECURITY;

-- Catalog: org members read; admin/hr write (helper: is_org_admin_or_hr)
DROP POLICY IF EXISTS "compliance_catalog_select" ON public.compliance_catalog;
CREATE POLICY "compliance_catalog_select" ON public.compliance_catalog
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "compliance_catalog_insert" ON public.compliance_catalog;
CREATE POLICY "compliance_catalog_insert" ON public.compliance_catalog
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_catalog_update" ON public.compliance_catalog;
CREATE POLICY "compliance_catalog_update" ON public.compliance_catalog
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "compliance_catalog_delete" ON public.compliance_catalog;
CREATE POLICY "compliance_catalog_delete" ON public.compliance_catalog
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- Employee compliance: org members read; admin/hr write
DROP POLICY IF EXISTS "employee_compliance_select" ON public.employee_compliance;
CREATE POLICY "employee_compliance_select" ON public.employee_compliance
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_compliance_insert" ON public.employee_compliance;
CREATE POLICY "employee_compliance_insert" ON public.employee_compliance
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_compliance_update" ON public.employee_compliance;
CREATE POLICY "employee_compliance_update" ON public.employee_compliance
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_compliance_delete" ON public.employee_compliance;
CREATE POLICY "employee_compliance_delete" ON public.employee_compliance
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compliance TO authenticated;

-- Ensure site_id is nullable on employee_compliance (for existing DBs that had NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_compliance' AND column_name = 'site_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.employee_compliance ALTER COLUMN site_id DROP NOT NULL;
  END IF;
END $$;
