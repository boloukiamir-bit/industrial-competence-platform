-- Bindings link to catalog: requirement_id on employee_requirement_bindings; RPC uses catalog when provided.
-- Legacy bindings (code/name only) remain valid. No refactors to existing drivers.

-- =============================================================================
-- 1) COLUMN: requirement_id on employee_requirement_bindings
-- =============================================================================
ALTER TABLE public.employee_requirement_bindings
  ADD COLUMN IF NOT EXISTS requirement_id uuid NULL
  REFERENCES public.compliance_requirements(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employee_requirement_bindings.requirement_id IS 'Optional link to catalog; when set, code/name are authoritative from catalog.';

CREATE INDEX IF NOT EXISTS idx_employee_requirement_bindings_org_requirement_id
  ON public.employee_requirement_bindings(org_id, requirement_id);

-- =============================================================================
-- 2) VIEW: v_employee_requirement_status — add requirement_id (part A from bindings, part B NULL)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_employee_requirement_status AS
-- A) Existing bindings with current computed status (requirement_id added at end to avoid column renames)
SELECT
  b.org_id,
  b.site_id,
  b.employee_id,
  b.requirement_code,
  b.requirement_name,
  b.valid_from,
  b.valid_to,
  b.status_override,
  b.evidence_url,
  b.note,
  CASE
    WHEN b.status_override IS NOT NULL THEN b.status_override
    WHEN b.valid_to IS NULL THEN 'WARNING'
    WHEN b.valid_to < (current_timestamp AT TIME ZONE 'UTC')::date THEN 'ILLEGAL'
    WHEN b.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'WARNING'
    ELSE 'GO'
  END AS computed_status,
  CASE
    WHEN b.status_override IS NOT NULL THEN 'OVERRIDDEN'
    WHEN b.valid_to IS NULL THEN 'MISSING_EXPIRY'
    WHEN b.valid_to < (current_timestamp AT TIME ZONE 'UTC')::date THEN 'EXPIRED'
    WHEN b.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END AS status_reason,
  b.requirement_id
FROM public.employee_requirement_bindings b

UNION ALL

-- B) Synthetic rows: mandatory rules with no binding
SELECT DISTINCT ON (employee_id, requirement_code)
  e.org_id,
  e.site_id,
  e.id AS employee_id,
  rule.requirement_code,
  rule.requirement_name,
  NULL::date AS valid_from,
  NULL::date AS valid_to,
  NULL::text AS status_override,
  NULL::text AS evidence_url,
  NULL::text AS note,
  'ILLEGAL'::text AS computed_status,
  'MISSING_REQUIRED'::text AS status_reason,
  NULL::uuid AS requirement_id
FROM public.employees e
JOIN public.employee_roles er ON er.employee_id = e.id AND er.org_id = e.org_id
JOIN public.roles r ON r.id = er.role_id AND r.org_id = e.org_id
JOIN public.requirement_role_rules rule ON rule.org_id = e.org_id AND rule.role = r.code AND rule.is_mandatory = true
LEFT JOIN public.employee_requirement_bindings b
  ON b.org_id = e.org_id AND b.employee_id = e.id AND b.requirement_code = rule.requirement_code
WHERE b.id IS NULL
ORDER BY employee_id, requirement_code, requirement_name;

COMMENT ON VIEW public.v_employee_requirement_status IS 'Deterministic status per binding or missing mandatory rule. requirement_id present for catalog-linked bindings.';

-- =============================================================================
-- 3) RPC: upsert_employee_requirement_binding_v1 — add p_requirement_id, catalog resolution
-- =============================================================================
DROP FUNCTION IF EXISTS public.upsert_employee_requirement_binding_v1(uuid, uuid, uuid, text, text, date, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.upsert_employee_requirement_binding_v1(
  p_org_id uuid,
  p_site_id uuid,
  p_employee_id uuid,
  p_requirement_code text,
  p_requirement_name text,
  p_valid_from date,
  p_valid_to date,
  p_status_override text,
  p_evidence_url text,
  p_note text,
  p_idempotency_key text,
  p_requirement_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_org_id uuid;
  v_binding_id uuid;
  v_idem text;
  v_code text;
  v_name text;
  v_catalog record;
BEGIN
  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_status_override IS NOT NULL AND p_status_override NOT IN ('GO', 'WARNING', 'ILLEGAL') THEN
    RAISE EXCEPTION 'Invalid status_override: must be GO, WARNING, or ILLEGAL'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_requirement_id IS NOT NULL THEN
    SELECT id, code, name INTO v_catalog
    FROM public.compliance_requirements
    WHERE id = p_requirement_id AND org_id = p_org_id AND is_active = true
    LIMIT 1;

    IF v_catalog.id IS NULL THEN
      RAISE EXCEPTION 'Catalog requirement not found or inactive'
        USING ERRCODE = 'P0003';
    END IF;

    v_code := v_catalog.code;
    v_name := v_catalog.name;
  ELSE
    v_code := p_requirement_code;
    v_name := p_requirement_name;
  END IF;

  INSERT INTO public.employee_requirement_bindings (
    org_id, site_id, employee_id, requirement_code, requirement_name, requirement_id,
    valid_from, valid_to, status_override, evidence_url, note,
    created_by, updated_by, idempotency_key
  )
  VALUES (
    p_org_id, p_site_id, p_employee_id, v_code, v_name,
    p_requirement_id,
    p_valid_from, p_valid_to, p_status_override, p_evidence_url, p_note,
    auth.uid(), auth.uid(), p_idempotency_key
  )
  ON CONFLICT (org_id, employee_id, requirement_code)
  DO UPDATE SET
    site_id = EXCLUDED.site_id,
    requirement_name = EXCLUDED.requirement_name,
    requirement_id = EXCLUDED.requirement_id,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    status_override = EXCLUDED.status_override,
    evidence_url = EXCLUDED.evidence_url,
    note = EXCLUDED.note,
    updated_by = auth.uid(),
    idempotency_key = EXCLUDED.idempotency_key;

  SELECT id INTO v_binding_id
  FROM public.employee_requirement_bindings
  WHERE org_id = p_org_id AND employee_id = p_employee_id AND requirement_code = v_code
  LIMIT 1;

  v_idem := 'EMP_REQ_UPSERT:' || p_org_id::text || ':' || p_employee_id::text || ':' || v_code || ':' || coalesce(p_idempotency_key, '');

  INSERT INTO public.governance_events (
    org_id, site_id, actor_user_id, action, target_type, target_id,
    outcome, legitimacy_status, readiness_status, reason_codes, meta, idempotency_key, created_at
  )
  VALUES (
    p_org_id, p_site_id, auth.uid(), 'EMPLOYEE_REQUIREMENT_UPSERT', 'EMPLOYEE', p_employee_id::text,
    'RECORDED', 'OK', 'NON_BLOCKING',
    ARRAY['COMPLIANCE_REQUIREMENT_BINDING_V1'],
    jsonb_build_object(
      'requirement_code', v_code,
      'requirement_name', v_name,
      'requirement_id', p_requirement_id,
      'valid_from', p_valid_from,
      'valid_to', p_valid_to,
      'status_override', p_status_override,
      'evidence_url', p_evidence_url
    ),
    v_idem, now()
  )
  ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  RETURN json_build_object('ok', true, 'binding_id', v_binding_id);
END;
$$;

COMMENT ON FUNCTION public.upsert_employee_requirement_binding_v1(uuid, uuid, uuid, text, text, date, date, text, text, text, text, uuid) IS
  'Upsert employee requirement binding; optional p_requirement_id links to catalog (code/name forced from catalog). P0003 = catalog not found.';

GRANT EXECUTE ON FUNCTION public.upsert_employee_requirement_binding_v1(uuid, uuid, uuid, text, text, date, date, text, text, text, text, uuid) TO authenticated;
