-- Spaljisten Organization Setup for Go-Live MVP
-- org_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890

-- ============================================================================
-- 1. CREATE SPALJISTEN ORGANIZATION
-- ============================================================================

-- Note: This requires a created_by user. Run this AFTER Daniel signs up.
-- For now, we'll use an admin insert approach.

-- First, check if org exists
DO $$
BEGIN
  -- We can't create the org until Daniel's user exists in auth.users
  -- This migration creates the org entry assuming service role bypass
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  ) THEN
    -- The organization table has a foreign key to auth.users for created_by
    -- We'll need to handle this after Daniel creates his account
    RAISE NOTICE 'Spaljisten organization needs to be created after Daniel signs up';
  ELSE
    RAISE NOTICE 'Spaljisten organization already exists';
  END IF;
END $$;

-- ============================================================================
-- 2. HELPER FUNCTION TO SET UP DANIEL AS ADMIN
-- ============================================================================

-- This function can be called after Daniel signs up to make him admin + data_owner
CREATE OR REPLACE FUNCTION public.sp_setup_daniel_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;
BEGIN
  -- Find Daniel's user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'daniel.buhre@spaljisten.se';

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User daniel.buhre@spaljisten.se not found. Please sign up first.'
    );
  END IF;

  -- Create organization if not exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
    INSERT INTO public.organizations (id, name, slug, created_by)
    VALUES (v_org_id, 'Spaljisten AB', 'spaljisten', v_user_id);
  END IF;

  -- Create or update membership WITH data_owner permission
  INSERT INTO public.memberships (org_id, user_id, role, status, permissions)
  VALUES (v_org_id, v_user_id, 'admin', 'active', '{"data_owner": true}'::jsonb)
  ON CONFLICT (org_id, user_id) 
  DO UPDATE SET role = 'admin', status = 'active', permissions = '{"data_owner": true}'::jsonb;

  -- Update profile
  INSERT INTO public.profiles (id, email)
  VALUES (v_user_id, 'daniel.buhre@spaljisten.se')
  ON CONFLICT (id) DO UPDATE SET email = 'daniel.buhre@spaljisten.se';

  -- Audit log
  INSERT INTO public.audit_logs (org_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (
    v_org_id,
    v_user_id,
    'admin.setup',
    'membership',
    v_user_id::text,
    jsonb_build_object('role', 'admin', 'data_owner', true, 'email', 'daniel.buhre@spaljisten.se', 'setup_type', 'go_live_mvp')
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'org_id', v_org_id,
    'role', 'admin',
    'data_owner', true
  );
END;
$$;

-- ============================================================================
-- 3. ADD DATA_OWNER FLAG TO MEMBERSHIPS (extend schema)
-- ============================================================================

-- Add permissions column to memberships for data_owner flag
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.memberships.permissions IS 
'Extended permissions like data_owner, can_export, etc.';

-- ============================================================================
-- 4. HELPER FUNCTION TO SET DATA OWNER PERMISSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sp_set_data_owner(p_user_email text, p_is_data_owner boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_user_email);

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update membership permissions
  UPDATE public.memberships
  SET permissions = permissions || jsonb_build_object('data_owner', p_is_data_owner)
  WHERE org_id = v_org_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membership not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'data_owner', p_is_data_owner);
END;
$$;

-- ============================================================================
-- INSTRUCTIONS FOR GO-LIVE
-- ============================================================================
/*
STEP 1: Daniel signs up at /login page with email: daniel.buhre@spaljisten.se

STEP 2: Run this SQL to make Daniel admin + data_owner:
  SELECT sp_setup_daniel_admin();
  SELECT sp_set_data_owner('daniel.buhre@spaljisten.se', true);

STEP 3: Daniel can now access:
  - /app/spaljisten/import  (CSV import)
  - /app/spaljisten/dashboard (Gap analysis)
  - /api/spaljisten/export (CSV export)
*/
