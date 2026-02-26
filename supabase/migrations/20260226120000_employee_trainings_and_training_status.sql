-- Training compliance driver (Daniel P0): employee_trainings table + deterministic status view.
-- Pilot: one training_code = 'SAFETY'. Rules: non-ACTIVE => GO; missing record => ILLEGAL (TRAINING_MISSING);
-- valid_to null => WARNING (TRAINING_MISSING_VALID_TO); valid_to < today => ILLEGAL (TRAINING_EXPIRED);
-- valid_to in [today, today+30] => WARNING (TRAINING_EXPIRING_SOON); else GO.

-- =============================================================================
-- 1) employee_trainings table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_code text NOT NULL,
  training_name text NULL,
  completed_on date NULL,
  valid_to date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, employee_id, training_code)
);

CREATE INDEX IF NOT EXISTS idx_employee_trainings_org_employee_code
  ON public.employee_trainings(org_id, employee_id, training_code);

COMMENT ON TABLE public.employee_trainings IS 'Training validity per employee and code (e.g. SAFETY). Used by v_employee_training_status and HR Inbox training tab.';

ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_trainings_select" ON public.employee_trainings;
CREATE POLICY "employee_trainings_select" ON public.employee_trainings
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "employee_trainings_insert" ON public.employee_trainings;
CREATE POLICY "employee_trainings_insert" ON public.employee_trainings
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_trainings_update" ON public.employee_trainings;
CREATE POLICY "employee_trainings_update" ON public.employee_trainings
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "employee_trainings_delete" ON public.employee_trainings;
CREATE POLICY "employee_trainings_delete" ON public.employee_trainings
  FOR DELETE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_trainings TO authenticated;

-- =============================================================================
-- 2) View: v_employee_training_status (SAFETY only for pilot)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_employee_training_status AS
SELECT
  e.id AS employee_id,
  e.org_id,
  e.site_id,
  e.name AS employee_name,
  COALESCE(t.training_code, 'SAFETY') AS training_code,
  t.valid_to,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN 'GO'
    WHEN t.employee_id IS NULL THEN 'ILLEGAL'
    WHEN t.valid_to IS NULL THEN 'WARNING'
    WHEN t.valid_to < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'ILLEGAL'
    WHEN t.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'WARNING'
    ELSE 'GO'
  END AS status,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN NULL
    WHEN t.employee_id IS NULL THEN 'TRAINING_MISSING'
    WHEN t.valid_to IS NULL THEN 'TRAINING_MISSING_VALID_TO'
    WHEN t.valid_to < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'TRAINING_EXPIRED'
    WHEN t.valid_to <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'TRAINING_EXPIRING_SOON'
    ELSE NULL
  END AS reason_code,
  CASE
    WHEN t.valid_to IS NULL THEN NULL
    ELSE (t.valid_to - ((current_timestamp AT TIME ZONE 'UTC')::date))::integer
  END AS days_to_expiry
FROM public.employees e
LEFT JOIN public.employee_trainings t
  ON e.id = t.employee_id AND t.training_code = 'SAFETY';

COMMENT ON VIEW public.v_employee_training_status IS 'Training (SAFETY) compliance status per employee: GO/WARNING/ILLEGAL, reason_code, days_to_expiry. Used by HR Inbox (training tab) and cockpit aggregation.';
