-- Patch fixed-term import: match by employment_external_id (Anst.id) first, then employee_number, then name.
-- Unmatched governance event meta includes attempted_key (staging.employee_number).

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
  v_staging_key text;
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
    v_staging_key := CASE WHEN v_row.employee_number IS NOT NULL AND trim(v_row.employee_number) <> '' THEN trim(v_row.employee_number) ELSE NULL END;

    -- Match: when staging.employee_number present, try (a) employment_external_id then (b) employee_number
    IF v_staging_key IS NOT NULL THEN
      SELECT e.id INTO v_emp_id FROM public.employees e
      WHERE e.org_id = p_org_id AND e.employment_external_id = v_staging_key LIMIT 1;
      IF v_emp_id IS NULL THEN
        SELECT e.id INTO v_emp_id FROM public.employees e
        WHERE e.org_id = p_org_id AND e.employee_number = v_staging_key LIMIT 1;
      END IF;
    END IF;
    -- Else or still no match: full name
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
          'attempted_key', v_staging_key,
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
  'Process hr_master_fixed_term_staging: match by employment_external_id (Anst.id) or employee_number then name; update employment_form and contract dates. Idempotent.';
