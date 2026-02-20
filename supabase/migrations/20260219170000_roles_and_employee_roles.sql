-- Phase B: Role model lock-in – roles and employee_roles (primary + secondary).
-- Hierarchical compliance; no UI changes. INSERT/UPDATE via service role only.

-- =============================================================================
-- 1) public.roles – org-scoped role definitions (code, name, type)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  role_type text NOT NULL DEFAULT 'STANDARD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

COMMENT ON TABLE public.roles IS 'Org-scoped role definitions for hierarchical compliance (e.g. STANDARD, ON_CALL, CONTRACTOR).';
COMMENT ON COLUMN public.roles.role_type IS 'E.g. STANDARD | ON_CALL | CONTRACTOR.';

CREATE INDEX IF NOT EXISTS idx_roles_org_id ON public.roles(org_id);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select_org ON public.roles;
CREATE POLICY roles_select_org
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT/UPDATE: service role only (no policy for authenticated).

-- =============================================================================
-- 2) public.employee_roles – assignments (primary + secondary) per employee
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, role_id)
);

COMMENT ON TABLE public.employee_roles IS 'Employee role assignments; exactly one primary per (org_id, employee_id).';
COMMENT ON COLUMN public.employee_roles.is_primary IS 'Exactly one row per (org_id, employee_id) has is_primary = true (enforced by partial unique index).';

-- Exactly one primary per (org_id, employee_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_roles_one_primary_per_employee
  ON public.employee_roles (org_id, employee_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_employee_roles_org_employee ON public.employee_roles(org_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_org_role ON public.employee_roles(org_id, role_id);

ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_roles_select_org ON public.employee_roles;
CREATE POLICY employee_roles_select_org
  ON public.employee_roles
  FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- INSERT/UPDATE: service role only (no policy for authenticated).

-- =============================================================================
-- 3) Seed: Spaljisten roles (idempotent, only if org exists)
-- =============================================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.roles (org_id, code, name, role_type)
  VALUES
    (v_org_id, 'OPERATOR', 'Operator', 'STANDARD'),
    (v_org_id, 'TEAM_LEADER', 'Team Leader', 'STANDARD'),
    (v_org_id, 'ELECTRICIAN', 'Electrician', 'STANDARD'),
    (v_org_id, 'MECHANIC', 'Mechanic', 'STANDARD'),
    (v_org_id, 'ON_CALL_ELECTRICIAN', 'On-call Electrician', 'ON_CALL')
  ON CONFLICT (org_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    role_type = EXCLUDED.role_type,
    active = true;

  RAISE NOTICE 'Phase B seed: Spaljisten roles applied';
END;
$$;
