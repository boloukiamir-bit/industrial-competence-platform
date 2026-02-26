-- Medical compliance driver (Daniel P0): employee_medicals table + deterministic status view.
-- Pilot: one medical_type = 'GENERAL'. Rules: non-ACTIVE => GO; missing record => ILLEGAL (MEDICAL_MISSING);
-- valid_to < today => ILLEGAL (MEDICAL_EXPIRED); valid_to in [today, today+30] => WARNING (MEDICAL_EXPIRING_SOON); else GO.

-- =============================================================================
-- 1) employee_medicals table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_medicals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  medical_type text NOT NULL,
  valid_from date NULL,
  valid_to date NULL,
  status_override text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, medical_type)
);

CREATE INDEX IF NOT EXISTS idx_employee_medicals_org_employee_type
  ON public.employee_medicals(org_id, employee_id, medical_type);

COMMENT ON TABLE public.employee_medicals IS 'Medical check validity per employee and type (e.g. GENERAL). Used by v_employee_medical_status and HR Inbox medical tab.';

ALTER TABLE public.employee_medicals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_medicals_select" ON public.employee_medicals;
CREATE POLICY "employee_medicals_select" ON public.employee_medicals
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_medicals_insert" ON public.employee_medicals;
CREATE POLICY "employee_medicals_insert" ON public.employee_medicals
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_medicals_update" ON public.employee_medicals;
CREATE POLICY "employee_medicals_update" ON public.employee_medicals
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_medicals_delete" ON public.employee_medicals;
CREATE POLICY "employee_medicals_delete" ON public.employee_medicals
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_medicals TO authenticated;

-- =============================================================================
-- 2) View: v_employee_medical_status (GENERAL only for pilot)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_employee_medical_status AS
SELECT
  e.id AS employee_id,
  e.org_id,
  e.site_id,
  e.name AS employee_name,
  COALESCE(m.medical_type, 'GENERAL') AS medical_type,
  m.valid_to,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN 'GO'
    WHEN m.employee_id IS NULL THEN 'ILLEGAL'
    WHEN m.valid_to IS NULL THEN 'ILLEGAL'
    WHEN m.valid_to < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'ILLEGAL'
    WHEN m.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'WARNING'
    ELSE 'GO'
  END AS status,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN NULL
    WHEN m.employee_id IS NULL THEN 'MEDICAL_MISSING'
    WHEN m.valid_to IS NULL THEN 'MEDICAL_MISSING'
    WHEN m.valid_to < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'MEDICAL_EXPIRED'
    WHEN m.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'MEDICAL_EXPIRING_SOON'
    ELSE NULL
  END AS reason_code,
  CASE
    WHEN m.valid_to IS NULL THEN NULL
    ELSE (m.valid_to - ((current_timestamp AT TIME ZONE 'UTC')::date))::integer
  END AS days_to_expiry
FROM public.employees e
LEFT JOIN public.employee_medicals m
  ON e.id = m.employee_id AND m.medical_type = 'GENERAL';

COMMENT ON VIEW public.v_employee_medical_status IS 'Medical (GENERAL) compliance status per employee: GO/WARNING/ILLEGAL, reason_code, days_to_expiry. Used by HR Inbox (medical tab) and cockpit aggregation.';
