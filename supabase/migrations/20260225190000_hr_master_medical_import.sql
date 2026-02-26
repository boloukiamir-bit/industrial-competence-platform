-- HR Master Medical import: staging table + deterministic upsert into compliance catalog + employee_compliance.
-- No Personnummer stored. Match by employee_number or full name (best-effort).
-- Two compliance items per employee: MED_ISO_HARDPLAST_FITNESS, TRN_HARDPLAST_AFS2014_43.

-- =============================================================================
-- 1) Staging table (tenant-scoped)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hr_master_medical_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_number text NULL,
  employee_name text NOT NULL,
  active_text text NULL,
  manager_name text NULL,
  iso_med_issued_at date NULL,
  iso_med_expires_at date NULL,
  hardplast_issued_at date NULL,
  hardplast_expires_at date NULL,
  comment text NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_master_medical_staging_org_employee_number
  ON public.hr_master_medical_staging(org_id, employee_number)
  WHERE employee_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hr_master_medical_staging_org_employee_name
  ON public.hr_master_medical_staging(org_id, employee_name);

COMMENT ON TABLE public.hr_master_medical_staging IS 'Staging for HR Master medical/certificate import; apply via apply_hr_master_medical_import(org_id, site_id).';

ALTER TABLE public.hr_master_medical_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_master_medical_staging_select" ON public.hr_master_medical_staging;
CREATE POLICY "hr_master_medical_staging_select" ON public.hr_master_medical_staging
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_master_medical_staging_insert" ON public.hr_master_medical_staging;
CREATE POLICY "hr_master_medical_staging_insert" ON public.hr_master_medical_staging
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_master_medical_staging_delete" ON public.hr_master_medical_staging;
CREATE POLICY "hr_master_medical_staging_delete" ON public.hr_master_medical_staging
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, DELETE ON public.hr_master_medical_staging TO authenticated;

-- =============================================================================
-- 2) Apply function: ensure catalog entries, match employees, upsert employee_compliance, governance_events
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_hr_master_medical_import(p_org_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE(
  staged_rows bigint,
  matched bigint,
  unmatched bigint,
  compliance_upserted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staged bigint := 0;
  v_matched bigint := 0;
  v_unmatched bigint := 0;
  v_upserted bigint := 0;
  v_cat_iso uuid;
  v_cat_hardplast uuid;
  v_row record;
  v_emp_id uuid;
  v_idem text;
BEGIN
  -- Ensure compliance catalog entries (2 codes) for this org
  INSERT INTO public.compliance_catalog (
    org_id, site_id, category, code, name, description, default_validity_days, is_active, created_at, updated_at
  )
  VALUES
    (p_org_id, NULL, 'medical', 'MED_ISO_HARDPLAST_FITNESS',
     'Tjänstbarhetsintyg isocyanater/härdplast',
     'Medical fitness certificate isocyanates/hard plastic',
     NULL, true, now(), now()),
    (p_org_id, NULL, 'medical', 'TRN_HARDPLAST_AFS2014_43',
     'Härdplastsutbildning AFS 2014:43',
     'Hard plastic training AFS 2014:43',
     NULL, true, now(), now())
  ON CONFLICT (org_id, code) DO UPDATE SET
    updated_at = now(),
    name = EXCLUDED.name,
    description = EXCLUDED.description;

  SELECT id INTO v_cat_iso FROM public.compliance_catalog WHERE org_id = p_org_id AND code = 'MED_ISO_HARDPLAST_FITNESS' LIMIT 1;
  SELECT id INTO v_cat_hardplast FROM public.compliance_catalog WHERE org_id = p_org_id AND code = 'TRN_HARDPLAST_AFS2014_43' LIMIT 1;

  IF v_cat_iso IS NULL OR v_cat_hardplast IS NULL THEN
    RAISE EXCEPTION 'apply_hr_master_medical_import: catalog entries missing for org %', p_org_id;
  END IF;

  FOR v_row IN
    SELECT s.id, s.org_id, s.site_id, s.employee_number, s.employee_name, s.comment,
           s.iso_med_issued_at, s.iso_med_expires_at, s.hardplast_issued_at, s.hardplast_expires_at
    FROM public.hr_master_medical_staging s
    WHERE s.org_id = p_org_id
      AND (p_site_id IS NULL OR s.site_id = p_site_id)
    ORDER BY s.imported_at, s.id
  LOOP
    v_staged := v_staged + 1;
    v_emp_id := NULL;

    -- Match: a) by employee_number when present, else b) by full name (best-effort)
    IF v_row.employee_number IS NOT NULL AND trim(v_row.employee_number) <> '' THEN
      SELECT e.id INTO v_emp_id
      FROM public.employees e
      WHERE e.org_id = p_org_id
        AND e.employee_number = trim(v_row.employee_number)
      LIMIT 1;
    END IF;

    IF v_emp_id IS NULL THEN
      SELECT e.id INTO v_emp_id
      FROM public.employees e
      WHERE e.org_id = p_org_id
        AND trim(lower(concat(trim(coalesce(e.first_name, '')), ' ', trim(coalesce(e.last_name, ''))))) = trim(lower(v_row.employee_name))
      ORDER BY e.id
      LIMIT 1;
    END IF;

    IF v_emp_id IS NULL THEN
      v_unmatched := v_unmatched + 1;
      v_idem := 'HR_MED_UNMATCHED:' || p_org_id::text || ':' || v_row.id::text;
      INSERT INTO public.governance_events (
        org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
        reason_codes, meta, idempotency_key, created_at
      )
      VALUES (
        p_org_id, v_row.site_id, 'HR_MASTER_IMPORT_UNMATCHED', 'EMPLOYEE', v_row.employee_name,
        'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['IMPORT'],
        jsonb_build_object('employee_name', v_row.employee_name, 'employee_number', v_row.employee_number, 'comment', v_row.comment),
        v_idem, now()
      )
      ON CONFLICT (org_id, idempotency_key) DO NOTHING;
      CONTINUE;
    END IF;

    v_matched := v_matched + 1;

    -- Upsert employee_compliance: MED_ISO_HARDPLAST_FITNESS (iso_med dates)
    INSERT INTO public.employee_compliance (
      org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at
    )
    VALUES (
      p_org_id, v_row.site_id, v_emp_id, v_cat_iso,
      v_row.iso_med_issued_at, v_row.iso_med_expires_at,
      v_row.comment, false, now(), now()
    )
    ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      notes = EXCLUDED.notes,
      site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id),
      updated_at = now();
    v_upserted := v_upserted + 1;

    v_idem := 'HR_MED_UPSERT:' || p_org_id::text || ':' || v_emp_id::text || ':MED_ISO_HARDPLAST_FITNESS:' || coalesce(v_row.iso_med_expires_at::text, '');
    INSERT INTO public.governance_events (
      org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
      reason_codes, meta, idempotency_key, created_at
    )
    VALUES (
      p_org_id, v_row.site_id, 'COMPLIANCE_ITEM_UPSERT', 'EMPLOYEE', v_emp_id::text,
      'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['MEDICAL'],
      jsonb_build_object('compliance_code', 'MED_ISO_HARDPLAST_FITNESS', 'expires_at', v_row.iso_med_expires_at),
      v_idem, now()
    )
    ON CONFLICT (org_id, idempotency_key) DO NOTHING;

    -- Upsert employee_compliance: TRN_HARDPLAST_AFS2014_43 (hardplast dates)
    INSERT INTO public.employee_compliance (
      org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at
    )
    VALUES (
      p_org_id, v_row.site_id, v_emp_id, v_cat_hardplast,
      v_row.hardplast_issued_at, v_row.hardplast_expires_at,
      v_row.comment, false, now(), now()
    )
    ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      notes = EXCLUDED.notes,
      site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id),
      updated_at = now();
    v_upserted := v_upserted + 1;

    v_idem := 'HR_MED_UPSERT:' || p_org_id::text || ':' || v_emp_id::text || ':TRN_HARDPLAST_AFS2014_43:' || coalesce(v_row.hardplast_expires_at::text, '');
    INSERT INTO public.governance_events (
      org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
      reason_codes, meta, idempotency_key, created_at
    )
    VALUES (
      p_org_id, v_row.site_id, 'COMPLIANCE_ITEM_UPSERT', 'EMPLOYEE', v_emp_id::text,
      'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['MEDICAL'],
      jsonb_build_object('compliance_code', 'TRN_HARDPLAST_AFS2014_43', 'expires_at', v_row.hardplast_expires_at),
      v_idem, now()
    )
    ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  END LOOP;

  RETURN QUERY SELECT v_staged, v_matched, v_unmatched, v_upserted;
END;
$$;

COMMENT ON FUNCTION public.apply_hr_master_medical_import(uuid, uuid) IS
  'Process hr_master_medical_staging for org (optional site): ensure catalog, match employees by number/name, upsert 2 compliance items per employee; log unmatched to governance_events. Idempotent.';

/*
  Manual test (after migration):
  1) Insert staging rows (replace <org_id> with real org uuid):
     INSERT INTO public.hr_master_medical_staging (org_id, employee_number, employee_name, iso_med_issued_at, iso_med_expires_at, hardplast_issued_at, hardplast_expires_at, comment)
     VALUES
       (<org_id>, 'E001', 'Anna Andersson', '2024-01-15'::date, '2025-01-15'::date, '2024-02-01'::date, '2025-02-01'::date, 'Import test 1'),
       (<org_id>, NULL, 'Bertil Bengtsson', '2024-03-01'::date, '2025-03-01'::date, '2024-03-15'::date, '2025-03-15'::date, 'Import test 2');
  2) Run apply:
     SELECT * FROM public.apply_hr_master_medical_import('<org_id>'::uuid, NULL);
  3) Check employee_compliance and governance_events for the org.
*/
