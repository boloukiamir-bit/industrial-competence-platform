-- Certificate compliance driver (Daniel P0): employee_certificates table + deterministic status view.
-- Pilot: one certificate_code = 'FORKLIFT'. Rules: non-ACTIVE => GO; missing record => ILLEGAL (CERT_MISSING);
-- valid_to null => WARNING (CERT_MISSING_VALID_TO); valid_to < today => ILLEGAL (CERT_EXPIRED);
-- valid_to in [today, today+30] => WARNING (CERT_EXPIRING_SOON); else GO.

-- =============================================================================
-- 1) employee_certificates table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  certificate_code text NOT NULL,
  certificate_name text NULL,
  issued_on date NULL,
  valid_to date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, certificate_code)
);

CREATE INDEX IF NOT EXISTS idx_employee_certificates_org_employee_code
  ON public.employee_certificates(org_id, employee_id, certificate_code);

COMMENT ON TABLE public.employee_certificates IS 'Certificate validity per employee and code (e.g. FORKLIFT). Used by v_employee_certificate_status and HR Inbox certificates tab.';

ALTER TABLE public.employee_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_certificates_select" ON public.employee_certificates;
CREATE POLICY "employee_certificates_select" ON public.employee_certificates
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_certificates_insert" ON public.employee_certificates;
CREATE POLICY "employee_certificates_insert" ON public.employee_certificates
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_certificates_update" ON public.employee_certificates;
CREATE POLICY "employee_certificates_update" ON public.employee_certificates
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_certificates_delete" ON public.employee_certificates;
CREATE POLICY "employee_certificates_delete" ON public.employee_certificates
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_certificates TO authenticated;

-- =============================================================================
-- 2) View: v_employee_certificate_status (FORKLIFT only for pilot)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_employee_certificate_status AS
SELECT
  e.id AS employee_id,
  e.org_id,
  e.site_id,
  e.name AS employee_name,
  COALESCE(c.certificate_code, 'FORKLIFT') AS certificate_code,
  c.valid_to,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN 'GO'
    WHEN c.employee_id IS NULL THEN 'ILLEGAL'
    WHEN c.valid_to IS NULL THEN 'WARNING'
    WHEN c.valid_to < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'ILLEGAL'
    WHEN c.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'WARNING'
    ELSE 'GO'
  END AS status,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN NULL
    WHEN c.employee_id IS NULL THEN 'CERT_MISSING'
    WHEN c.valid_to IS NULL THEN 'CERT_MISSING_VALID_TO'
    WHEN c.valid_to < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'CERT_EXPIRED'
    WHEN c.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'CERT_EXPIRING_SOON'
    ELSE NULL
  END AS reason_code,
  CASE
    WHEN c.valid_to IS NULL THEN NULL
    ELSE (c.valid_to - ((current_timestamp AT TIME ZONE 'UTC')::date))::integer
  END AS days_to_expiry
FROM public.employees e
LEFT JOIN public.employee_certificates c
  ON e.id = c.employee_id AND c.certificate_code = 'FORKLIFT';

COMMENT ON VIEW public.v_employee_certificate_status IS 'Certificate (FORKLIFT) compliance status per employee: GO/WARNING/ILLEGAL, reason_code, days_to_expiry. Used by HR Inbox (certificates tab) and cockpit aggregation.';
