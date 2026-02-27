-- Compliance Requirement Binding v1: tenant-safe, audited, deterministic.
-- Table: employee_requirement_bindings; View: v_employee_requirement_status; RPC: upsert_employee_requirement_binding_v1.
-- Does not touch existing compliance drivers, cockpit, or compliance matrix.

-- =============================================================================
-- 1) TABLE: public.employee_requirement_bindings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_requirement_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  requirement_name text NOT NULL,
  valid_from date NULL,
  valid_to date NULL,
  status_override text NULL CHECK (status_override IN ('GO', 'WARNING', 'ILLEGAL')),
  evidence_url text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  idempotency_key text NULL,
  UNIQUE (org_id, employee_id, requirement_code)
);

COMMENT ON TABLE public.employee_requirement_bindings IS 'Per-employee compliance requirement bindings (validity, override, evidence). V1: org-scoped, audited via governance_events.';

CREATE INDEX IF NOT EXISTS idx_employee_requirement_bindings_org_employee
  ON public.employee_requirement_bindings(org_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_requirement_bindings_org_code
  ON public.employee_requirement_bindings(org_id, requirement_code);

CREATE INDEX IF NOT EXISTS idx_employee_requirement_bindings_org_valid_to
  ON public.employee_requirement_bindings(org_id, valid_to);

-- updated_at auto-update trigger
CREATE OR REPLACE FUNCTION public.set_employee_requirement_bindings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_requirement_bindings_updated_at ON public.employee_requirement_bindings;
CREATE TRIGGER employee_requirement_bindings_updated_at
  BEFORE UPDATE ON public.employee_requirement_bindings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_requirement_bindings_updated_at();

-- =============================================================================
-- 2) RLS: org-scoped (match employee_certificates / employee_compliance pattern)
-- =============================================================================
ALTER TABLE public.employee_requirement_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_requirement_bindings_select" ON public.employee_requirement_bindings;
CREATE POLICY "employee_requirement_bindings_select" ON public.employee_requirement_bindings
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_requirement_bindings_insert" ON public.employee_requirement_bindings;
CREATE POLICY "employee_requirement_bindings_insert" ON public.employee_requirement_bindings
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_requirement_bindings_update" ON public.employee_requirement_bindings;
CREATE POLICY "employee_requirement_bindings_update" ON public.employee_requirement_bindings
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_requirement_bindings_delete" ON public.employee_requirement_bindings;
CREATE POLICY "employee_requirement_bindings_delete" ON public.employee_requirement_bindings
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_requirement_bindings TO authenticated;

-- =============================================================================
-- 3) VIEW: public.v_employee_requirement_status (deterministic per binding row)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_employee_requirement_status AS
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
  END AS status_reason
FROM public.employee_requirement_bindings b;

COMMENT ON VIEW public.v_employee_requirement_status IS 'Deterministic status per binding: OVERRIDDEN | MISSING_EXPIRY | EXPIRED | EXPIRING_SOON | VALID. V1: 30-day window.';

-- =============================================================================
-- 4) RPC: public.upsert_employee_requirement_binding_v1 (SECURITY DEFINER, audit)
-- =============================================================================
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
  p_idempotency_key text
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
BEGIN
  -- Enforce caller active org
  SELECT active_org_id INTO v_active_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_active_org_id IS NULL OR v_active_org_id != p_org_id THEN
    RAISE EXCEPTION 'Org mismatch: caller active org does not match p_org_id'
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate status_override if provided
  IF p_status_override IS NOT NULL AND p_status_override NOT IN ('GO', 'WARNING', 'ILLEGAL') THEN
    RAISE EXCEPTION 'Invalid status_override: must be GO, WARNING, or ILLEGAL'
      USING ERRCODE = 'P0001';
  END IF;

  -- Upsert by (org_id, employee_id, requirement_code)
  INSERT INTO public.employee_requirement_bindings (
    org_id, site_id, employee_id, requirement_code, requirement_name,
    valid_from, valid_to, status_override, evidence_url, note,
    created_by, updated_by, idempotency_key
  )
  VALUES (
    p_org_id, p_site_id, p_employee_id, p_requirement_code, p_requirement_name,
    p_valid_from, p_valid_to, p_status_override, p_evidence_url, p_note,
    auth.uid(), auth.uid(), p_idempotency_key
  )
  ON CONFLICT (org_id, employee_id, requirement_code)
  DO UPDATE SET
    site_id = EXCLUDED.site_id,
    requirement_name = EXCLUDED.requirement_name,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    status_override = EXCLUDED.status_override,
    evidence_url = EXCLUDED.evidence_url,
    note = EXCLUDED.note,
    updated_by = auth.uid(),
    idempotency_key = EXCLUDED.idempotency_key;

  SELECT id INTO v_binding_id
  FROM public.employee_requirement_bindings
  WHERE org_id = p_org_id AND employee_id = p_employee_id AND requirement_code = p_requirement_code
  LIMIT 1;

  -- Governance event (dedupe by idempotency_key)
  v_idem := 'EMP_REQ_UPSERT:' || p_org_id::text || ':' || p_employee_id::text || ':' || p_requirement_code || ':' || coalesce(p_idempotency_key, '');

  INSERT INTO public.governance_events (
    org_id, site_id, actor_user_id, action, target_type, target_id,
    outcome, legitimacy_status, readiness_status, reason_codes, meta, idempotency_key, created_at
  )
  VALUES (
    p_org_id, p_site_id, auth.uid(), 'EMPLOYEE_REQUIREMENT_UPSERT', 'EMPLOYEE', p_employee_id::text,
    'RECORDED', 'OK', 'NON_BLOCKING',
    ARRAY['COMPLIANCE_REQUIREMENT_BINDING_V1'],
    jsonb_build_object(
      'requirement_code', p_requirement_code,
      'requirement_name', p_requirement_name,
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

COMMENT ON FUNCTION public.upsert_employee_requirement_binding_v1(uuid, uuid, uuid, text, text, date, date, text, text, text, text) IS
  'Upsert employee requirement binding; enforce active org; write governance_events. Idempotent by (org_id, employee_id, requirement_code).';

-- =============================================================================
-- 5) GRANTS
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.upsert_employee_requirement_binding_v1(uuid, uuid, uuid, text, text, date, date, text, text, text, text) TO authenticated;
