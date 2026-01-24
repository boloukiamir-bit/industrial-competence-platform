-- =============================================================================
-- Tenant Bootstrap: Spaljisten AB (Customer #1)
-- =============================================================================
-- Run via Supabase migrations or SQL Editor.
-- Creates org, membership for user 7440a1f9-f4a3-41a0-8332-320dc71353ce, and
-- default site "Main". Idempotent; safe to run multiple times.
-- =============================================================================

-- Bootstrap Spaljisten org, membership, and default site.
-- User must exist in auth.users. Replace user_id if different.
DO $$
DECLARE
  v_user_id uuid := '7440a1f9-f4a3-41a0-8332-320dc71353ce'::uuid;
  v_org_id uuid;
BEGIN
  -- 1) Org row for Spaljisten AB, slug 'spaljisten'
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES ('Spaljisten AB', 'spaljisten', v_user_id)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    created_by = COALESCE(public.organizations.created_by, EXCLUDED.created_by)
  RETURNING id INTO v_org_id;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create or resolve Spaljisten org';
  END IF;

  -- Ensure permissions column exists before inserting (admin_setup migration adds it)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE public.memberships ADD COLUMN permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  -- 2) Membership: admin, active (current org via first active membership)
  INSERT INTO public.memberships (org_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, 'admin', 'active')
  ON CONFLICT (org_id, user_id) DO UPDATE SET
    role = 'admin',
    status = 'active';

  -- 3) Default site "Main" for Spaljisten (at most one per org from this bootstrap)
  IF NOT EXISTS (
    SELECT 1 FROM public.org_units WHERE org_id = v_org_id AND type = 'site' LIMIT 1
  ) THEN
    INSERT INTO public.org_units (org_id, name, code, type)
    VALUES (v_org_id, 'Main', 'MAIN', 'site');
  END IF;

  RAISE NOTICE 'Bootstrap complete: org_id=%, user_id=%, slug=spaljisten', v_org_id, v_user_id;
END;
$$;
