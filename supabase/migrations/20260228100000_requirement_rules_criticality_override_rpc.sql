-- Requirement rules: criticality_override controllable via RPC (create + update).
-- Extends create_requirement_rule_v1 and update_requirement_rule_v1. No view changes.

DROP FUNCTION IF EXISTS public.create_requirement_rule_v1(uuid, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.update_requirement_rule_v1(uuid, uuid, boolean, text);

-- =============================================================================
-- 1) create_requirement_rule_v1 — add p_criticality_override
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_requirement_rule_v1(
  p_org_id uuid,
  p_role text,
  p_requirement_code text,
  p_requirement_name text,
  p_is_mandatory boolean,
  p_idempotency_key text DEFAULT NULL,
  p_criticality_override text DEFAULT NULL
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
  IF p_criticality_override IS NOT NULL AND p_criticality_override NOT IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') THEN
    RAISE EXCEPTION 'criticality_override must be CRITICAL, HIGH, MEDIUM, LOW, or null'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.requirement_role_rules (
    org_id, role, requirement_code, requirement_name, is_mandatory, criticality_override
  )
  VALUES (
    p_org_id, p_role, p_requirement_code, p_requirement_name, coalesce(p_is_mandatory, true),
    p_criticality_override
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
      'is_mandatory', coalesce(p_is_mandatory, true),
      'criticality_override', p_criticality_override
    ),
    v_idem
  )
  ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  RETURN json_build_object('ok', true, 'rule_id', v_rule_id);
END;
$$;

COMMENT ON FUNCTION public.create_requirement_rule_v1(uuid, text, text, text, boolean, text, text) IS
  'Create requirement rule with optional criticality_override. Idempotent by idempotency_key.';

-- =============================================================================
-- 2) update_requirement_rule_v1 — add p_criticality_override
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_requirement_rule_v1(
  p_org_id uuid,
  p_rule_id uuid,
  p_is_mandatory boolean,
  p_idempotency_key text DEFAULT NULL,
  p_criticality_override text DEFAULT NULL
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
  IF p_criticality_override IS NOT NULL AND p_criticality_override NOT IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') THEN
    RAISE EXCEPTION 'criticality_override must be CRITICAL, HIGH, MEDIUM, LOW, or null'
      USING ERRCODE = 'P0001';
  END IF;

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
    SELECT role, requirement_code, requirement_name, is_mandatory, criticality_override
    FROM public.requirement_role_rules
    WHERE id = p_rule_id AND org_id = p_org_id
    FOR UPDATE
  ) r;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Requirement rule not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.requirement_role_rules
  SET is_mandatory = p_is_mandatory,
      criticality_override = p_criticality_override
  WHERE id = p_rule_id AND org_id = p_org_id;

  v_after := jsonb_build_object(
    'role', v_before->'role',
    'requirement_code', v_before->'requirement_code',
    'requirement_name', v_before->'requirement_name',
    'is_mandatory', to_jsonb(p_is_mandatory::boolean),
    'criticality_override', to_jsonb(p_criticality_override)
  );

  v_idem := coalesce(
    p_idempotency_key,
    'REQ_RULE_UPDATE:' || p_org_id::text || ':' || p_rule_id::text || ':' || p_is_mandatory::text || ':' || coalesce(p_criticality_override, '')
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

COMMENT ON FUNCTION public.update_requirement_rule_v1(uuid, uuid, boolean, text, text) IS
  'Update requirement rule is_mandatory and criticality_override; write governance event. Not found = P0002.';

-- =============================================================================
-- 3) GRANTS (new signatures)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.create_requirement_rule_v1(uuid, text, text, text, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_requirement_rule_v1(uuid, uuid, boolean, text, text) TO authenticated;
