-- Requirement rules CRUD: atomic rule + governance_events in a single transaction.
-- RPCs: create_requirement_rule_v1, update_requirement_rule_v1, delete_requirement_rule_v1.
-- Caller must pass p_org_id; enforced against profiles.active_org_id (P0001). Not found = P0002.

-- =============================================================================
-- 1) create_requirement_rule_v1
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_requirement_rule_v1(
  p_org_id uuid,
  p_role text,
  p_requirement_code text,
  p_requirement_name text,
  p_is_mandatory boolean,
  p_idempotency_key text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_org_id uuid;
  v_rule_id uuid;
  v_idem text;
BEGIN
  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.requirement_role_rules (
    org_id, role, requirement_code, requirement_name, is_mandatory
  )
  VALUES (
    p_org_id, p_role, p_requirement_code, p_requirement_name, coalesce(p_is_mandatory, true)
  )
  RETURNING id INTO v_rule_id;

  v_idem := coalesce(
    p_idempotency_key,
    'REQ_RULE_CREATE:' || p_org_id::text || ':' || p_role || ':' || p_requirement_code
  );

  INSERT INTO public.governance_events (
    org_id, site_id, actor_user_id, action, target_type, target_id,
    outcome, legitimacy_status, readiness_status, reason_codes, meta, idempotency_key
  )
  VALUES (
    p_org_id,
    NULL,
    auth.uid(),
    'REQUIREMENT_RULE_CREATE',
    'REQUIREMENT_RULE',
    v_rule_id::text,
    'RECORDED',
    'OK',
    'NON_BLOCKING',
    ARRAY['COMPLIANCE_REQUIREMENT_RULES_V1'],
    jsonb_build_object(
      'role', p_role,
      'requirement_code', p_requirement_code,
      'requirement_name', p_requirement_name,
      'is_mandatory', coalesce(p_is_mandatory, true)
    ),
    v_idem
  )
  ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  RETURN json_build_object('ok', true, 'rule_id', v_rule_id);
END;
$$;

COMMENT ON FUNCTION public.create_requirement_rule_v1(uuid, text, text, text, boolean, text) IS
  'Create requirement rule and governance event in one transaction. Idempotent by idempotency_key; ON CONFLICT DO NOTHING for governance.';

-- =============================================================================
-- 2) update_requirement_rule_v1
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_requirement_rule_v1(
  p_org_id uuid,
  p_rule_id uuid,
  p_is_mandatory boolean,
  p_idempotency_key text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_org_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_idem text;
BEGIN
  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(r) INTO v_before
  FROM (
    SELECT role, requirement_code, requirement_name, is_mandatory
    FROM public.requirement_role_rules
    WHERE id = p_rule_id AND org_id = p_org_id
    FOR UPDATE
  ) r;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Requirement rule not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.requirement_role_rules
  SET is_mandatory = p_is_mandatory
  WHERE id = p_rule_id AND org_id = p_org_id;

  v_after := jsonb_set(
    v_before,
    '{is_mandatory}',
    to_jsonb(p_is_mandatory::boolean)
  );

  v_idem := coalesce(
    p_idempotency_key,
    'REQ_RULE_UPDATE:' || p_org_id::text || ':' || p_rule_id::text || ':' || p_is_mandatory::text
  );

  INSERT INTO public.governance_events (
    org_id, site_id, actor_user_id, action, target_type, target_id,
    outcome, legitimacy_status, readiness_status, reason_codes, meta, idempotency_key
  )
  VALUES (
    p_org_id,
    NULL,
    auth.uid(),
    'REQUIREMENT_RULE_UPDATE',
    'REQUIREMENT_RULE',
    p_rule_id::text,
    'RECORDED',
    'OK',
    'NON_BLOCKING',
    ARRAY['COMPLIANCE_REQUIREMENT_RULES_V1'],
    jsonb_build_object('before', v_before, 'after', v_after),
    v_idem
  )
  ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  RETURN json_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.update_requirement_rule_v1(uuid, uuid, boolean, text) IS
  'Update requirement rule is_mandatory and write governance event. Not found = P0002.';

-- =============================================================================
-- 3) delete_requirement_rule_v1
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_requirement_rule_v1(
  p_org_id uuid,
  p_rule_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_org_id uuid;
  v_deleted jsonb;
  v_idem text;
BEGIN
  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(r) INTO v_deleted
  FROM (
    SELECT role, requirement_code, requirement_name, is_mandatory
    FROM public.requirement_role_rules
    WHERE id = p_rule_id AND org_id = p_org_id
    FOR UPDATE
  ) r;

  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'Requirement rule not found'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.requirement_role_rules
  WHERE id = p_rule_id AND org_id = p_org_id;

  v_idem := coalesce(
    p_idempotency_key,
    'REQ_RULE_DELETE:' || p_org_id::text || ':' || p_rule_id::text
  );

  INSERT INTO public.governance_events (
    org_id, site_id, actor_user_id, action, target_type, target_id,
    outcome, legitimacy_status, readiness_status, reason_codes, meta, idempotency_key
  )
  VALUES (
    p_org_id,
    NULL,
    auth.uid(),
    'REQUIREMENT_RULE_DELETE',
    'REQUIREMENT_RULE',
    p_rule_id::text,
    'RECORDED',
    'OK',
    'NON_BLOCKING',
    ARRAY['COMPLIANCE_REQUIREMENT_RULES_V1'],
    jsonb_build_object('deleted', v_deleted),
    v_idem
  )
  ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  RETURN json_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.delete_requirement_rule_v1(uuid, uuid, text) IS
  'Delete requirement rule and write governance event. Not found = P0002.';

-- =============================================================================
-- 4) GRANTS
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.create_requirement_rule_v1(uuid, text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_requirement_rule_v1(uuid, uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_requirement_rule_v1(uuid, uuid, text) TO authenticated;
