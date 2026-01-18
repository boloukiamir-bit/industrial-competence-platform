-- PART B: Admin Setup (Separate from RLS migration)
-- Uses org slug lookup - NO hardcoded org_id

-- Add permissions column to memberships (safe if already exists)
ALTER TABLE public.memberships
ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Safe admin setup function: uses org slug, no hardcoded org_id
CREATE OR REPLACE FUNCTION public.sp_setup_admin_by_slug(p_email text, p_org_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email);

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found. Please sign up first at /login');
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE lower(slug) = lower(p_org_slug);

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization slug not found. Create org first.');
  END IF;

  INSERT INTO public.memberships (org_id, user_id, role, status, permissions)
  VALUES (v_org_id, v_user_id, 'admin', 'active', '{"data_owner": true}'::jsonb)
  ON CONFLICT (org_id, user_id)
  DO UPDATE SET role='admin', status='active', permissions='{"data_owner": true}'::jsonb;

  INSERT INTO public.profiles (id, email)
  VALUES (v_user_id, p_email)
  ON CONFLICT (id) DO UPDATE SET email = p_email;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'org_id', v_org_id, 'role', 'admin', 'data_owner', true);
END;
$$;

-- USAGE (run after users have signed up):
-- SELECT public.sp_setup_admin_by_slug('amir@bolouki.se', 'spaljisten');
-- SELECT public.sp_setup_admin_by_slug('daniel.buhre@spaljisten.se', 'spaljisten');
