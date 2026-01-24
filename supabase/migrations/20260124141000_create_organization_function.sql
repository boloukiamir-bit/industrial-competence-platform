-- =============================================================================
-- create_organization(): Safe org creation for SQL Editor / migrations
-- =============================================================================
-- No organizations.status (column does not exist).
-- created_by is required; do NOT use auth.uid() (unavailable in SQL Editor).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text,
  p_slug text,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name is required');
  END IF;
  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'slug is required');
  END IF;
  IF p_created_by IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'created_by is required');
  END IF;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (trim(p_name), trim(p_slug), p_created_by)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    created_by = COALESCE(public.organizations.created_by, EXCLUDED.created_by)
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (org_id, user_id, role, status)
  VALUES (v_org_id, p_created_by, 'admin', 'active')
  ON CONFLICT (org_id, user_id) DO UPDATE SET
    role = 'admin',
    status = 'active';

  RETURN jsonb_build_object('success', true, 'org_id', v_org_id, 'slug', p_slug);
END;
$$;

COMMENT ON FUNCTION public.create_organization(text, text, uuid) IS
  'Create org and admin membership. created_by required; do not use auth.uid(). Use from SQL Editor or service role.';

GRANT EXECUTE ON FUNCTION public.create_organization(text, text, uuid) TO service_role;
