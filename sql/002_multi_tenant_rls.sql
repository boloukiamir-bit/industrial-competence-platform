-- Multi-Tenant RLS Migration
-- Creates organizations, memberships, invites, audit_logs tables with full RLS

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Memberships table (links users to organizations with roles)
CREATE TABLE IF NOT EXISTS public.memberships (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'hr', 'manager', 'user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Indexes for memberships
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON public.memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_role ON public.memberships(org_id, role);

-- Invites table
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'hr', 'manager', 'user')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id)
);

-- Unique constraint on pending invites (same email can't be invited twice to same org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_org_email_pending 
  ON public.invites(org_id, lower(email)) 
  WHERE accepted_at IS NULL;

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created 
  ON public.audit_logs(org_id, created_at DESC);

-- Ensure profiles table exists (from Phase 1)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Check if current user is a member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = check_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Check if current user is an admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = check_org_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- ----- ORGANIZATIONS -----

-- Users can only see orgs they are members of
DROP POLICY IF EXISTS "Users can view their orgs" ON public.organizations;
CREATE POLICY "Users can view their orgs" ON public.organizations
  FOR SELECT
  USING (public.is_org_member(id));

-- Authenticated users can create orgs (server route handles admin membership)
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
CREATE POLICY "Authenticated users can create orgs" ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can update org details
DROP POLICY IF EXISTS "Org admins can update org" ON public.organizations;
CREATE POLICY "Org admins can update org" ON public.organizations
  FOR UPDATE
  USING (public.is_org_admin(id));

-- ----- MEMBERSHIPS -----

-- Users can view their own memberships
DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
CREATE POLICY "Users can view own memberships" ON public.memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- Org admins can view all memberships in their org
DROP POLICY IF EXISTS "Org admins can view all memberships" ON public.memberships;
CREATE POLICY "Org admins can view all memberships" ON public.memberships
  FOR SELECT
  USING (public.is_org_admin(org_id));

-- Org admins can insert memberships (for invites)
DROP POLICY IF EXISTS "Org admins can insert memberships" ON public.memberships;
CREATE POLICY "Org admins can insert memberships" ON public.memberships
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

-- Org admins can update memberships (role/status changes)
DROP POLICY IF EXISTS "Org admins can update memberships" ON public.memberships;
CREATE POLICY "Org admins can update memberships" ON public.memberships
  FOR UPDATE
  USING (public.is_org_admin(org_id));

-- Org admins can delete memberships
DROP POLICY IF EXISTS "Org admins can delete memberships" ON public.memberships;
CREATE POLICY "Org admins can delete memberships" ON public.memberships
  FOR DELETE
  USING (public.is_org_admin(org_id));

-- ----- INVITES -----

-- Only org admins can view invites
DROP POLICY IF EXISTS "Org admins can view invites" ON public.invites;
CREATE POLICY "Org admins can view invites" ON public.invites
  FOR SELECT
  USING (public.is_org_admin(org_id));

-- Only org admins can create invites
DROP POLICY IF EXISTS "Org admins can create invites" ON public.invites;
CREATE POLICY "Org admins can create invites" ON public.invites
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

-- Only org admins can delete invites
DROP POLICY IF EXISTS "Org admins can delete invites" ON public.invites;
CREATE POLICY "Org admins can delete invites" ON public.invites
  FOR DELETE
  USING (public.is_org_admin(org_id));

-- ----- AUDIT LOGS -----

-- Org admins can view audit logs
DROP POLICY IF EXISTS "Org admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Org admins can view audit logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_org_admin(org_id));

-- Org admins can insert audit logs (server routes use service role)
DROP POLICY IF EXISTS "Org admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Org admins can insert audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id) OR auth.uid() IS NULL);

-- ----- PROFILES -----

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Allow profile creation (for trigger)
DROP POLICY IF EXISTS "Allow profile insert" ON public.profiles;
CREATE POLICY "Allow profile insert" ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 5. TRIGGER: AUTO-CREATE PROFILE AND CLAIM INVITES ON USER SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Upsert profile for the new user
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Check for pending invites and claim them
  FOR invite_record IN
    SELECT id, org_id, role
    FROM public.invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  LOOP
    -- Create membership for the user
    INSERT INTO public.memberships (org_id, user_id, role, status)
    VALUES (invite_record.org_id, NEW.id, invite_record.role, 'active')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- Mark invite as accepted
    UPDATE public.invites
    SET accepted_at = now(),
        accepted_user_id = NEW.id
    WHERE id = invite_record.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. GRANTS (ensure authenticated users can use these)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.memberships TO authenticated;
GRANT ALL ON public.invites TO authenticated;
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
