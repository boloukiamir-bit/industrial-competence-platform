-- employee_profiles: 1:1 richer profile (photo, address, emergency contact, notes).
-- Tenant-scoped by org_id + site_id (session active_org_id / active_site_id).

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  photo_url text,
  bio text,
  address text,
  city text,
  postal_code text,
  country text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_org_id ON public.employee_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_site_id ON public.employee_profiles(site_id);

-- updated_at auto-update trigger
CREATE OR REPLACE FUNCTION public.set_employee_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_profiles_updated_at ON public.employee_profiles;
CREATE TRIGGER employee_profiles_updated_at
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_profiles_updated_at();

-- RLS: tenant-scoped by active_org_id + active_site_id (allow when site_id is null or matches session)
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

-- Helper: user can see row if org member and (no site or site matches active_site_id)
CREATE OR REPLACE FUNCTION public.employee_profiles_visible(check_org_id uuid, check_site_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_org_member(check_org_id)
  AND (
    check_site_id IS NULL
    OR check_site_id = (SELECT active_site_id FROM public.profiles WHERE id = auth.uid())
  );
$$;

DROP POLICY IF EXISTS "employee_profiles_select" ON public.employee_profiles;
CREATE POLICY "employee_profiles_select" ON public.employee_profiles
  FOR SELECT USING (public.employee_profiles_visible(org_id, site_id));

DROP POLICY IF EXISTS "employee_profiles_insert" ON public.employee_profiles;
CREATE POLICY "employee_profiles_insert" ON public.employee_profiles
  FOR INSERT WITH CHECK (public.employee_profiles_visible(org_id, site_id));

DROP POLICY IF EXISTS "employee_profiles_update" ON public.employee_profiles;
CREATE POLICY "employee_profiles_update" ON public.employee_profiles
  FOR UPDATE USING (public.employee_profiles_visible(org_id, site_id));

DROP POLICY IF EXISTS "employee_profiles_delete" ON public.employee_profiles;
CREATE POLICY "employee_profiles_delete" ON public.employee_profiles
  FOR DELETE USING (public.employee_profiles_visible(org_id, site_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_profiles TO service_role;
