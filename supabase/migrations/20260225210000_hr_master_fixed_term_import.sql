-- HR Master fixed-term employment import: staging + deterministic apply.
-- Populates employees.employment_form, contract_start_date, contract_end_date.
-- Match by employee_number or full name. No UI. No personal number.

-- =============================================================================
-- 1) Staging table (tenant-scoped)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hr_master_fixed_term_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_number text NULL,
  employee_name text NOT NULL,
  employment_form text NULL,
  contract_start_date date NULL,
  contract_end_date date NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_master_fixed_term_staging_org_employee_number
  ON public.hr_master_fixed_term_staging(org_id, employee_number)
  WHERE employee_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hr_master_fixed_term_staging_org_employee_name
  ON public.hr_master_fixed_term_staging(org_id, employee_name);

COMMENT ON TABLE public.hr_master_fixed_term_staging IS 'Staging for HR Master fixed-term/contract import; apply via apply_hr_master_fixed_term_import(org_id, site_id).';

ALTER TABLE public.hr_master_fixed_term_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_master_fixed_term_staging_select" ON public.hr_master_fixed_term_staging;
CREATE POLICY "hr_master_fixed_term_staging_select" ON public.hr_master_fixed_term_staging
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_master_fixed_term_staging_insert" ON public.hr_master_fixed_term_staging;
CREATE POLICY "hr_master_fixed_term_staging_insert" ON public.hr_master_fixed_term_staging
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_master_fixed_term_staging_delete" ON public.hr_master_fixed_term_staging;
CREATE POLICY "hr_master_fixed_term_staging_delete" ON public.hr_master_fixed_term_staging
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, DELETE ON public.hr_master_fixed_term_staging TO authenticated;

-- =============================================================================
-- 2) Apply function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_hr_master_fixed_term_import(p_org_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE(
  staged_rows bigint,
  matched bigint,
  unmatched bigint,
  updated bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staged bigint := 0;
  v_matched bigint := 0;
  v_unmatched bigint := 0;
  v_updated bigint := 0;
  v_row record;
  v_emp_id uuid;
  v_idem text;
  v_any_change boolean;
BEGIN
  FOR v_row IN
    SELECT s.id, s.org_id, s.site_id, s.employee_number, s.employee_name,
           s.employment_form, s.contract_start_date, s.contract_end_date
    FROM public.hr_master_fixed_term_staging s
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
      v_idem := 'HR_FIXED_UNMATCHED:' || p_org_id::text || ':' || v_row.id::text;
      INSERT INTO public.governance_events (
        org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
        reason_codes, meta, idempotency_key, created_at
      )
      VALUES (
        p_org_id, v_row.site_id, 'HR_MASTER_IMPORT_UNMATCHED', 'EMPLOYEE', v_row.employee_name,
        'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['IMPORT'],
        jsonb_build_object(
          'employee_name', v_row.employee_name,
          'employee_number', v_row.employee_number,
          'employment_form', v_row.employment_form,
          'contract_start_date', v_row.contract_start_date,
          'contract_end_date', v_row.contract_end_date
        ),
        v_idem, now()
      )
      ON CONFLICT (org_id, idempotency_key) DO NOTHING;
      CONTINUE;
    END IF;

    v_matched := v_matched + 1;

    -- Update employees only when at least one value differs
    UPDATE public.employees e
    SET
      employment_form = v_row.employment_form,
      contract_start_date = v_row.contract_start_date,
      contract_end_date = v_row.contract_end_date
    WHERE e.id = v_emp_id
      AND (
        e.employment_form IS DISTINCT FROM v_row.employment_form
        OR e.contract_start_date IS DISTINCT FROM v_row.contract_start_date
        OR e.contract_end_date IS DISTINCT FROM v_row.contract_end_date
      );

    v_any_change := FOUND;
    IF v_any_change THEN
      v_updated := v_updated + 1;
    END IF;

    -- Always record governance event for the apply (idempotent by key)
    v_idem := 'CONTRACT:' || v_emp_id::text || ':' || coalesce(v_row.contract_end_date::text, 'null') || ':' || coalesce(v_row.employment_form, 'null');
    INSERT INTO public.governance_events (
      org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status,
      reason_codes, meta, idempotency_key, created_at
    )
    VALUES (
      p_org_id, v_row.site_id, 'EMPLOYMENT_CONTRACT_UPSERT', 'EMPLOYEE', v_emp_id::text,
      'RECORDED', 'OK', 'NON_BLOCKING', ARRAY['CONTRACT'],
      jsonb_build_object(
        'employee_id', v_emp_id,
        'employee_number', v_row.employee_number,
        'employment_form', v_row.employment_form,
        'contract_start_date', v_row.contract_start_date,
        'contract_end_date', v_row.contract_end_date
      ),
      v_idem, now()
    )
    ON CONFLICT (org_id, idempotency_key) DO NOTHING;

  END LOOP;

  RETURN QUERY SELECT v_staged, v_matched, v_unmatched, v_updated;
END;
$$;

COMMENT ON FUNCTION public.apply_hr_master_fixed_term_import(uuid, uuid) IS
  'Process hr_master_fixed_term_staging: match employees by number/name, update employment_form and contract dates; log unmatched and each apply to governance_events. Idempotent.';

/*
  Manual test (replace <org_id> with real org uuid; ensure an employee with employee_number='45' exists for the org):
  1) INSERT 2 staging rows (one matching employee_number, one unmatched):
     INSERT INTO public.hr_master_fixed_term_staging (org_id, employee_number, employee_name, employment_form, contract_start_date, contract_end_date)
     VALUES
       (<org_id>, '45', 'Existing Employee Name', 'Visstid - Överenskommen', '2023-01-15'::date, '2025-06-30'::date),
       (<org_id>, NULL, 'No Such Person', 'Tillsvidare', '2020-01-01'::date, NULL);
  2) Run apply:
     SELECT * FROM public.apply_hr_master_fixed_term_import('<org_id>'::uuid, NULL);
  3) Check employee and governance_events:
     SELECT employee_number, employment_form, contract_start_date, contract_end_date
     FROM public.employees WHERE org_id = '<org_id>' AND employee_number = '45';
     SELECT action, target_type, target_id, reason_codes, meta, idempotency_key
     FROM public.governance_events
     WHERE org_id = '<org_id>' AND action IN ('EMPLOYMENT_CONTRACT_UPSERT', 'HR_MASTER_IMPORT_UNMATCHED')
     ORDER BY created_at DESC LIMIT 5;
*/
