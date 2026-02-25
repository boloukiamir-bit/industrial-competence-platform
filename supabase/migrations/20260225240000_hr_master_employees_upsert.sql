-- HR Master Employee Upsert: staging + apply to create/update employees by employment_external_id (Anst.id).
-- Enables fixed-term/medical/training imports to match instead of producing unmatched rows. No UI.

-- =============================================================================
-- 1) Staging table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hr_master_employees_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employment_external_id text NOT NULL,
  employee_name text NOT NULL,
  employment_form text NULL,
  contract_start_date date NULL,
  contract_end_date date NULL,
  active_text text NULL,
  manager_name text NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employment_external_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_master_employees_staging_org_employee_name
  ON public.hr_master_employees_staging(org_id, employee_name);

COMMENT ON TABLE public.hr_master_employees_staging IS 'Staging for HR Master employee upsert; apply via apply_hr_master_employees_upsert(org_id, site_id).';

ALTER TABLE public.hr_master_employees_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_master_employees_staging_select" ON public.hr_master_employees_staging;
CREATE POLICY "hr_master_employees_staging_select" ON public.hr_master_employees_staging
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_master_employees_staging_insert" ON public.hr_master_employees_staging;
CREATE POLICY "hr_master_employees_staging_insert" ON public.hr_master_employees_staging
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_master_employees_staging_delete" ON public.hr_master_employees_staging;
CREATE POLICY "hr_master_employees_staging_delete" ON public.hr_master_employees_staging
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, DELETE ON public.hr_master_employees_staging TO authenticated;

-- =============================================================================
-- 2) Helper: split full name into first_name, last_name
-- =============================================================================
CREATE OR REPLACE FUNCTION public.split_full_name(p_name text)
RETURNS TABLE(first_name text, last_name text)
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_clean text;
  v_parts text[];
  v_n int;
  v_first text;
  v_last text;
BEGIN
  v_clean := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF v_clean = '' THEN
    first_name := '';
    last_name := '';
    RETURN NEXT;
    RETURN;
  END IF;

  IF position(',' in v_clean) > 0 THEN
    -- "Last, First" -> last_name = before comma, first_name = after comma
    last_name := trim(split_part(v_clean, ',', 1));
    first_name := trim(substring(v_clean from position(',' in v_clean) + 1));
  ELSE
    v_parts := regexp_split_to_array(v_clean, ' ');
    v_n := array_length(v_parts, 1);
    IF v_n IS NULL OR v_n <= 1 THEN
      first_name := v_clean;
      last_name := '';
    ELSE
      last_name := v_parts[v_n];
      first_name := array_to_string(v_parts[1 : v_n - 1], ' ');
    END IF;
  END IF;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.split_full_name(text) IS 'Split full name: trim/collapse spaces; comma => Last, First; else last token = last_name, rest = first_name.';

-- =============================================================================
-- 3) Apply function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_hr_master_employees_upsert(p_org_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE(
  staged_rows bigint,
  inserted bigint,
  updated bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staged bigint := 0;
  v_inserted bigint := 0;
  v_updated bigint := 0;
  v_row record;
  v_emp_id uuid;
  v_idem text;
  v_first text;
  v_last text;
  v_display_name text;
  v_status text;
  v_any_change boolean;
  v_existing record;
BEGIN
  FOR v_row IN
    SELECT s.id, s.org_id, s.site_id, s.employment_external_id, s.employee_name,
           s.employment_form, s.contract_start_date, s.contract_end_date, s.active_text
    FROM public.hr_master_employees_staging s
    WHERE s.org_id = p_org_id
      AND (p_site_id IS NULL OR s.site_id = p_site_id)
    ORDER BY s.imported_at, s.id
  LOOP
    v_staged := v_staged + 1;

    SELECT t.first_name, t.last_name INTO v_first, v_last
    FROM public.split_full_name(v_row.employee_name) t LIMIT 1;
    v_display_name := trim(regexp_replace(trim(v_row.employee_name), '\s+', ' ', 'g'));
    IF v_display_name = '' THEN
      v_display_name := coalesce(v_first, '') || ' ' || coalesce(v_last, '');
    END IF;

    -- employment_status from active_text
    v_status := NULL;
    IF v_row.active_text IS NOT NULL AND trim(v_row.active_text) <> '' THEN
      IF trim(lower(v_row.active_text)) LIKE '%aktiv%' AND trim(lower(v_row.active_text)) NOT LIKE '%inaktiv%' THEN
        v_status := 'ACTIVE';
      ELSIF trim(lower(v_row.active_text)) LIKE '%inaktiv%' THEN
        v_status := 'INACTIVE';
      ELSIF trim(lower(v_row.active_text)) LIKE '%slutat%' THEN
        v_status := 'TERMINATED';
      END IF;
    END IF;

    SELECT e.id, e.employee_number, e.first_name, e.last_name, e.name,
           e.employment_form, e.contract_start_date, e.contract_end_date, e.employment_status
    INTO v_existing
    FROM public.employees e
    WHERE e.org_id = p_org_id AND e.employment_external_id = trim(v_row.employment_external_id)
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      -- INSERT
      INSERT INTO public.employees (
        org_id, site_id, employment_external_id, employee_number, name, first_name, last_name,
        employment_form, contract_start_date, contract_end_date, employment_status,
        hire_date, status_changed_at
      )
      VALUES (
        p_org_id, v_row.site_id, trim(v_row.employment_external_id), trim(v_row.employment_external_id),
        v_display_name, v_first, v_last,
        v_row.employment_form, v_row.contract_start_date, v_row.contract_end_date,
        coalesce(v_status, 'ACTIVE'),
        coalesce(v_row.contract_start_date, current_date), now()
      )
      RETURNING id INTO v_emp_id;
      v_inserted := v_inserted + 1;

      v_idem := 'EMP_UPSERT:' || v_emp_id::text || ':' || coalesce(v_row.contract_end_date::text, 'null') || ':' || coalesce(v_row.employment_form, 'null') || ':' || coalesce(v_status, 'ACTIVE');
      INSERT INTO public.governance_events (
        org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
        reason_codes, meta, idempotency_key, created_at
      )
      VALUES (
        p_org_id, v_row.site_id, 'EMPLOYEE_UPSERT_CREATE', 'EMPLOYEE', v_emp_id::text,
        'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['IMPORT'],
        jsonb_build_object(
          'employment_external_id', v_row.employment_external_id,
          'employee_name', v_row.employee_name,
          'employment_form', v_row.employment_form,
          'contract_start_date', v_row.contract_start_date,
          'contract_end_date', v_row.contract_end_date
        ),
        v_idem, now()
      )
      ON CONFLICT (org_id, idempotency_key) DO NOTHING;
    ELSE
      -- UPDATE: only set employee_number when existing is null; else preserve
      v_emp_id := v_existing.id;
      v_any_change :=
        (v_existing.first_name IS DISTINCT FROM v_first)
        OR (v_existing.last_name IS DISTINCT FROM v_last)
        OR (v_existing.name IS DISTINCT FROM v_display_name)
        OR (v_existing.employment_form IS DISTINCT FROM v_row.employment_form)
        OR (v_existing.contract_start_date IS DISTINCT FROM v_row.contract_start_date)
        OR (v_existing.contract_end_date IS DISTINCT FROM v_row.contract_end_date)
        OR (v_status IS NOT NULL AND (v_existing.employment_status IS DISTINCT FROM v_status));

      IF v_any_change THEN
        UPDATE public.employees e
        SET
          first_name = v_first,
          last_name = v_last,
          name = v_display_name,
          employment_form = v_row.employment_form,
          contract_start_date = v_row.contract_start_date,
          contract_end_date = v_row.contract_end_date,
          employee_number = CASE WHEN e.employee_number IS NULL OR trim(e.employee_number) = '' THEN trim(v_row.employment_external_id) ELSE e.employee_number END,
          employment_status = CASE WHEN v_status IS NOT NULL THEN v_status ELSE e.employment_status END
        WHERE e.id = v_emp_id;
        v_updated := v_updated + 1;
      END IF;

      v_idem := 'EMP_UPSERT:' || v_emp_id::text || ':' || coalesce(v_row.contract_end_date::text, 'null') || ':' || coalesce(v_row.employment_form, 'null') || ':' || coalesce(v_status, v_existing.employment_status, 'null');
      INSERT INTO public.governance_events (
        org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
        reason_codes, meta, idempotency_key, created_at
      )
      VALUES (
        p_org_id, v_row.site_id, 'EMPLOYEE_UPSERT_UPDATE', 'EMPLOYEE', v_emp_id::text,
        'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['IMPORT'],
        jsonb_build_object(
          'employment_external_id', v_row.employment_external_id,
          'employee_name', v_row.employee_name,
          'employment_form', v_row.employment_form,
          'contract_start_date', v_row.contract_start_date,
          'contract_end_date', v_row.contract_end_date
        ),
        v_idem, now()
      )
      ON CONFLICT (org_id, idempotency_key) DO NOTHING;
    END IF;

  END LOOP;

  RETURN QUERY SELECT v_staged, v_inserted, v_updated;
END;
$$;

COMMENT ON FUNCTION public.apply_hr_master_employees_upsert(uuid, uuid) IS
  'Upsert employees from hr_master_employees_staging by (org_id, employment_external_id). Create missing; update existing without overwriting employee_number when set. Idempotent.';

/*
  Manual test (replace <org_id> with real org uuid):
  1) Insert staging rows for external ids 45 and 428:
     INSERT INTO public.hr_master_employees_staging (org_id, employment_external_id, employee_name, employment_form, contract_start_date, contract_end_date)
     VALUES
       (<org_id>, '45', 'Anna Andersson', 'Visstid - Överenskommen', '2023-01-15'::date, '2025-06-30'::date),
       (<org_id>, '428', 'Bertil Bengtsson', 'Tillsvidare', '2020-06-01'::date, NULL);
  2) Run apply:
     SELECT * FROM public.apply_hr_master_employees_upsert('<org_id>'::uuid, NULL);
  3) Verify employees exist:
     SELECT id, employment_external_id, employee_number, name, first_name, last_name, employment_form, contract_end_date
     FROM public.employees WHERE org_id = '<org_id>' AND employment_external_id IN ('45', '428');
  4) Re-run apply (idempotent): SELECT * FROM public.apply_hr_master_employees_upsert('<org_id>'::uuid, NULL);
  5) Then run fixed-term import to attach contracts: SELECT * FROM public.apply_hr_master_fixed_term_import('<org_id>'::uuid, NULL);
*/
