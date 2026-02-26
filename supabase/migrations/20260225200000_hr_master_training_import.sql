-- HR Master Training import: staging table + deterministic apply into compliance catalog + employee_compliance.
-- Wide Excel -> normalized records. Match by employee_number or full name. No personal number stored.
-- Reuses public.compliance_catalog (category training) and public.employee_compliance.

-- =============================================================================
-- 0) Allow 'training' in compliance_catalog category
-- =============================================================================
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.compliance_catalog'::regclass AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%category%'
  LIMIT 1;
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.compliance_catalog DROP CONSTRAINT %I', v_conname);
  END IF;
  ALTER TABLE public.compliance_catalog
    ADD CONSTRAINT compliance_catalog_category_check
    CHECK (category IN ('license','medical','contract','training'));
END $$;

-- =============================================================================
-- 1) Staging table (tenant-scoped)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hr_master_training_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_number text NULL,
  employee_name text NOT NULL,

  bam_digital_completed date NULL,
  bam_digital_expires date NULL,

  bam_3d_completed date NULL,
  bam_3d_expires date NULL,

  business_ethics_completed date NULL,
  business_ethics_expires date NULL,

  pefc_fsc_completed date NULL,
  pefc_fsc_expires date NULL,

  hot_works_completed date NULL,
  hot_works_expires date NULL,

  hlr_text text NULL,
  first_aid_text text NULL,
  fire_text text NULL,

  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_master_training_staging_org_employee_number
  ON public.hr_master_training_staging(org_id, employee_number)
  WHERE employee_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hr_master_training_staging_org_employee_name
  ON public.hr_master_training_staging(org_id, employee_name);

COMMENT ON TABLE public.hr_master_training_staging IS 'Staging for HR Master training import; apply via apply_hr_master_training_import(org_id, site_id).';

ALTER TABLE public.hr_master_training_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_master_training_staging_select" ON public.hr_master_training_staging;
CREATE POLICY "hr_master_training_staging_select" ON public.hr_master_training_staging
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_master_training_staging_insert" ON public.hr_master_training_staging;
CREATE POLICY "hr_master_training_staging_insert" ON public.hr_master_training_staging
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_master_training_staging_delete" ON public.hr_master_training_staging;
CREATE POLICY "hr_master_training_staging_delete" ON public.hr_master_training_staging
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, DELETE ON public.hr_master_training_staging TO authenticated;

-- =============================================================================
-- 2) Parse Swedish date from text (e.g. "HLR 25/4-2023", "Brand 6/10 -2021")
-- =============================================================================
CREATE OR REPLACE FUNCTION public.parse_swedish_date_from_text(p_text text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_dd int;
  v_mm int;
  v_yyyy int;
  v_match text[];
BEGIN
  IF p_text IS NULL OR trim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  -- Match dd/mm-yyyy or dd/mm -yyyy (optional space before hyphen)
  v_match := regexp_match(p_text, '(\d{1,2})/(\d{1,2})\s*-\s*(\d{4})');
  IF v_match IS NULL OR array_length(v_match, 1) < 4 THEN
    RETURN NULL;
  END IF;
  v_dd := v_match[1]::int;
  v_mm := v_match[2]::int;
  v_yyyy := v_match[3]::int;
  IF v_mm < 1 OR v_mm > 12 OR v_dd < 1 OR v_dd > 31 THEN
    RETURN NULL;
  END IF;
  RETURN make_date(v_yyyy, v_mm, v_dd);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.parse_swedish_date_from_text(text) IS 'Extract first dd/mm-yyyy (or dd/mm -yyyy) from text; returns NULL on parse failure.';

-- =============================================================================
-- 3) Ensure training catalog entries (8 codes) + apply staging -> employee_compliance
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_hr_master_training_import(p_org_id uuid, p_site_id uuid DEFAULT NULL)
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
  v_cat_ids jsonb;  -- map code -> id
  v_row record;
  v_emp_id uuid;
  v_idem text;
  v_completed date;
  v_expires date;
  v_note text;
  v_cat_id uuid;
BEGIN
  -- Ensure 8 training catalog entries for this org
  INSERT INTO public.compliance_catalog (
    org_id, site_id, category, code, name, description, default_validity_days, is_active, created_at, updated_at
  )
  VALUES
    (p_org_id, NULL, 'training', 'TRN_BAM_DIGITAL_1D', 'BAM Digital 1D', 'BAM digital training', NULL, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_BAM_3D', 'BAM 3D', 'BAM 3D training', NULL, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_BUSINESS_ETHICS', 'Business ethics', 'Business ethics training', NULL, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_PEFC_FSC_TRACE', 'PEFC/FSC traceability', 'PEFC/FSC traceability training', NULL, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_HOT_WORKS', 'Hot works', 'Hot works training', NULL, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_HLR', 'HLR', 'HLR (CPR) training', 730, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_FIRST_AID', 'First aid', 'First aid training', 730, true, now(), now()),
    (p_org_id, NULL, 'training', 'TRN_FIRE_SAFETY', 'Fire safety', 'Fire safety training', 1095, true, now(), now())
  ON CONFLICT (org_id, code) DO UPDATE SET updated_at = now(), name = EXCLUDED.name, description = EXCLUDED.description;

  -- Build code -> catalog id map for this org
  SELECT jsonb_object_agg(code, id) INTO v_cat_ids
  FROM public.compliance_catalog
  WHERE org_id = p_org_id
    AND code IN (
      'TRN_BAM_DIGITAL_1D', 'TRN_BAM_3D', 'TRN_BUSINESS_ETHICS', 'TRN_PEFC_FSC_TRACE',
      'TRN_HOT_WORKS', 'TRN_HLR', 'TRN_FIRST_AID', 'TRN_FIRE_SAFETY'
    );
  IF v_cat_ids IS NULL THEN
    RAISE EXCEPTION 'apply_hr_master_training_import: catalog entries missing for org %', p_org_id;
  END IF;

  FOR v_row IN
    SELECT s.id, s.org_id, s.site_id, s.employee_number, s.employee_name,
           s.bam_digital_completed, s.bam_digital_expires,
           s.bam_3d_completed, s.bam_3d_expires,
           s.business_ethics_completed, s.business_ethics_expires,
           s.pefc_fsc_completed, s.pefc_fsc_expires,
           s.hot_works_completed, s.hot_works_expires,
           s.hlr_text, s.first_aid_text, s.fire_text
    FROM public.hr_master_training_staging s
    WHERE s.org_id = p_org_id
      AND (p_site_id IS NULL OR s.site_id = p_site_id)
    ORDER BY s.imported_at, s.id
  LOOP
    v_staged := v_staged + 1;
    v_emp_id := NULL;

    IF v_row.employee_number IS NOT NULL AND trim(v_row.employee_number) <> '' THEN
      SELECT e.id INTO v_emp_id FROM public.employees e
      WHERE e.org_id = p_org_id AND e.employee_number = trim(v_row.employee_number) LIMIT 1;
    END IF;
    IF v_emp_id IS NULL THEN
      SELECT e.id INTO v_emp_id FROM public.employees e
      WHERE e.org_id = p_org_id
        AND trim(lower(concat(trim(coalesce(e.first_name, '')), ' ', trim(coalesce(e.last_name, ''))))) = trim(lower(v_row.employee_name))
      ORDER BY e.id LIMIT 1;
    END IF;

    IF v_emp_id IS NULL THEN
      v_unmatched := v_unmatched + 1;
      v_idem := 'HR_TRN_UNMATCHED:' || p_org_id::text || ':' || v_row.id::text;
      INSERT INTO public.governance_events (
        org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
        reason_codes, meta, idempotency_key, created_at
      )
      VALUES (
        p_org_id, v_row.site_id, 'HR_MASTER_IMPORT_UNMATCHED', 'EMPLOYEE', v_row.employee_name,
        'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['IMPORT'],
        jsonb_build_object('employee_name', v_row.employee_name, 'employee_number', v_row.employee_number, 'source', 'training'),
        v_idem, now()
      )
      ON CONFLICT (org_id, idempotency_key) DO NOTHING;
      CONTINUE;
    END IF;

    v_matched := v_matched + 1;

    -- Helper: upsert one training record
    -- v_cat_id, v_completed, v_expires, v_note set by caller for each course

    -- TRN_BAM_DIGITAL_1D
    v_cat_id := (v_cat_ids->>'TRN_BAM_DIGITAL_1D')::uuid;
    IF v_cat_id IS NOT NULL AND (v_row.bam_digital_completed IS NOT NULL OR v_row.bam_digital_expires IS NOT NULL) THEN
      v_completed := v_row.bam_digital_completed;
      v_expires := v_row.bam_digital_expires;
      v_note := NULL;
      INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
      VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
      ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
        valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
        site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
      v_upserted := v_upserted + 1;
    END IF;

    -- TRN_BAM_3D
    v_cat_id := (v_cat_ids->>'TRN_BAM_3D')::uuid;
    IF v_cat_id IS NOT NULL AND (v_row.bam_3d_completed IS NOT NULL OR v_row.bam_3d_expires IS NOT NULL) THEN
      v_completed := v_row.bam_3d_completed;
      v_expires := v_row.bam_3d_expires;
      v_note := NULL;
      INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
      VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
      ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
        valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
        site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
      v_upserted := v_upserted + 1;
    END IF;

    -- TRN_BUSINESS_ETHICS
    v_cat_id := (v_cat_ids->>'TRN_BUSINESS_ETHICS')::uuid;
    IF v_cat_id IS NOT NULL AND (v_row.business_ethics_completed IS NOT NULL OR v_row.business_ethics_expires IS NOT NULL) THEN
      v_completed := v_row.business_ethics_completed;
      v_expires := v_row.business_ethics_expires;
      v_note := NULL;
      INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
      VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
      ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
        valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
        site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
      v_upserted := v_upserted + 1;
    END IF;

    -- TRN_PEFC_FSC_TRACE
    v_cat_id := (v_cat_ids->>'TRN_PEFC_FSC_TRACE')::uuid;
    IF v_cat_id IS NOT NULL AND (v_row.pefc_fsc_completed IS NOT NULL OR v_row.pefc_fsc_expires IS NOT NULL) THEN
      v_completed := v_row.pefc_fsc_completed;
      v_expires := v_row.pefc_fsc_expires;
      v_note := NULL;
      INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
      VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
      ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
        valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
        site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
      v_upserted := v_upserted + 1;
    END IF;

    -- TRN_HOT_WORKS
    v_cat_id := (v_cat_ids->>'TRN_HOT_WORKS')::uuid;
    IF v_cat_id IS NOT NULL AND (v_row.hot_works_completed IS NOT NULL OR v_row.hot_works_expires IS NOT NULL) THEN
      v_completed := v_row.hot_works_completed;
      v_expires := v_row.hot_works_expires;
      v_note := NULL;
      INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
      VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
      ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
        valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
        site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
      v_upserted := v_upserted + 1;
    END IF;

    -- TRN_HLR: completed = parse(hlr_text), expires = completed + 2 years
    v_cat_id := (v_cat_ids->>'TRN_HLR')::uuid;
    IF v_cat_id IS NOT NULL AND v_row.hlr_text IS NOT NULL AND trim(v_row.hlr_text) <> '' THEN
      v_completed := public.parse_swedish_date_from_text(v_row.hlr_text);
      IF v_completed IS NOT NULL THEN
        v_expires := (v_completed + interval '2 years')::date;
        v_note := trim(v_row.hlr_text);
        INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
        VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
        ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
          valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
          site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
        v_upserted := v_upserted + 1;
      END IF;
    END IF;

    -- TRN_FIRST_AID: completed = parse(first_aid_text), expires = completed + 2 years
    v_cat_id := (v_cat_ids->>'TRN_FIRST_AID')::uuid;
    IF v_cat_id IS NOT NULL AND v_row.first_aid_text IS NOT NULL AND trim(v_row.first_aid_text) <> '' THEN
      v_completed := public.parse_swedish_date_from_text(v_row.first_aid_text);
      IF v_completed IS NOT NULL THEN
        v_expires := (v_completed + interval '2 years')::date;
        v_note := trim(v_row.first_aid_text);
        INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
        VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
        ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
          valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
          site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
        v_upserted := v_upserted + 1;
      END IF;
    END IF;

    -- TRN_FIRE_SAFETY: completed = parse(fire_text), expires = completed + 3 years
    v_cat_id := (v_cat_ids->>'TRN_FIRE_SAFETY')::uuid;
    IF v_cat_id IS NOT NULL AND v_row.fire_text IS NOT NULL AND trim(v_row.fire_text) <> '' THEN
      v_completed := public.parse_swedish_date_from_text(v_row.fire_text);
      IF v_completed IS NOT NULL THEN
        v_expires := (v_completed + interval '3 years')::date;
        v_note := trim(v_row.fire_text);
        INSERT INTO public.employee_compliance (org_id, site_id, employee_id, compliance_id, valid_from, valid_to, notes, waived, created_at, updated_at)
        VALUES (p_org_id, v_row.site_id, v_emp_id, v_cat_id, v_completed, v_expires, v_note, false, now(), now())
        ON CONFLICT (org_id, employee_id, compliance_id) DO UPDATE SET
          valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, notes = EXCLUDED.notes,
          site_id = coalesce(EXCLUDED.site_id, employee_compliance.site_id), updated_at = now();
        v_upserted := v_upserted + 1;
      END IF;
    END IF;

  END LOOP;

  RETURN QUERY SELECT v_staged, v_matched, v_unmatched, v_upserted;
END;
$$;

COMMENT ON FUNCTION public.apply_hr_master_training_import(uuid, uuid) IS
  'Process hr_master_training_staging: ensure 8 training catalog codes, match employees by number/name, upsert employee_compliance per course; log unmatched to governance_events. Idempotent.';

/*
  Manual test:
  1) INSERT 2 staging rows (replace <org_id>), one with HLR text:
     INSERT INTO public.hr_master_training_staging (org_id, employee_number, employee_name, hlr_text, first_aid_text, fire_text)
     VALUES
       (<org_id>, 'E001', 'Anna Andersson', 'HLR 25/4-2023', 'Första hjälp 28/9 -2021', 'Brand 6/10 -2021'),
       (<org_id>, NULL, 'Bertil Bengtsson', NULL, NULL, NULL);
  2) SELECT * FROM public.apply_hr_master_training_import('<org_id>'::uuid, NULL);
  3) For Anna: HLR completed_at = 2023-04-25, expires_at = 2025-04-25; First aid 2021-09-28, expires 2023-09-28; Fire 2021-10-06, expires 2024-10-06.
*/
