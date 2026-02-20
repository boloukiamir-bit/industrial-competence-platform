-- Induction Core: checkpoints (org/site-scoped), employee enrollment, completions.
-- RLS: org members read; admin/hr write (is_org_member, is_org_admin_or_hr).

CREATE TABLE IF NOT EXISTS public.induction_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  stage text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Org-wide: one row per (org_id, code) when site_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_induction_checkpoints_org_code_org_wide
  ON public.induction_checkpoints (org_id, code) WHERE site_id IS NULL;

-- Site-specific: one row per (org_id, site_id, code)
CREATE UNIQUE INDEX IF NOT EXISTS idx_induction_checkpoints_org_site_code
  ON public.induction_checkpoints (org_id, site_id, code) WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_induction_checkpoints_org ON public.induction_checkpoints(org_id);
CREATE INDEX IF NOT EXISTS idx_induction_checkpoints_org_site ON public.induction_checkpoints(org_id, site_id);

CREATE TABLE IF NOT EXISTS public.employee_induction (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('RESTRICTED', 'CLEARED')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_induction_org_site ON public.employee_induction(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_employee_induction_employee ON public.employee_induction(employee_id);

CREATE TABLE IF NOT EXISTS public.employee_induction_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES public.induction_checkpoints(id) ON DELETE RESTRICT,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid,
  UNIQUE (employee_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_induction_completions_org_site ON public.employee_induction_completions(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_employee_induction_completions_employee ON public.employee_induction_completions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_induction_completions_checkpoint ON public.employee_induction_completions(checkpoint_id);

ALTER TABLE public.induction_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_induction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_induction_completions ENABLE ROW LEVEL SECURITY;

-- induction_checkpoints: org members read; admin/hr write
DROP POLICY IF EXISTS "induction_checkpoints_select" ON public.induction_checkpoints;
CREATE POLICY "induction_checkpoints_select" ON public.induction_checkpoints
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "induction_checkpoints_insert" ON public.induction_checkpoints;
CREATE POLICY "induction_checkpoints_insert" ON public.induction_checkpoints
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "induction_checkpoints_update" ON public.induction_checkpoints;
CREATE POLICY "induction_checkpoints_update" ON public.induction_checkpoints
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "induction_checkpoints_delete" ON public.induction_checkpoints;
CREATE POLICY "induction_checkpoints_delete" ON public.induction_checkpoints
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- employee_induction: org members read; admin/hr write
DROP POLICY IF EXISTS "employee_induction_select" ON public.employee_induction;
CREATE POLICY "employee_induction_select" ON public.employee_induction
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_induction_insert" ON public.employee_induction;
CREATE POLICY "employee_induction_insert" ON public.employee_induction
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_induction_update" ON public.employee_induction;
CREATE POLICY "employee_induction_update" ON public.employee_induction
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_induction_delete" ON public.employee_induction;
CREATE POLICY "employee_induction_delete" ON public.employee_induction
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

-- employee_induction_completions: org members read; admin/hr write
DROP POLICY IF EXISTS "employee_induction_completions_select" ON public.employee_induction_completions;
CREATE POLICY "employee_induction_completions_select" ON public.employee_induction_completions
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_induction_completions_insert" ON public.employee_induction_completions;
CREATE POLICY "employee_induction_completions_insert" ON public.employee_induction_completions
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_induction_completions_update" ON public.employee_induction_completions;
CREATE POLICY "employee_induction_completions_update" ON public.employee_induction_completions
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_induction_completions_delete" ON public.employee_induction_completions;
CREATE POLICY "employee_induction_completions_delete" ON public.employee_induction_completions
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_checkpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_induction TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_induction_completions TO authenticated;
