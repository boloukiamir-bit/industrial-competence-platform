-- Fixed-term employment support (contract end date from HR master).
-- Columns: employment_form (e.g. Visstid), contract_start_date (Anst.datum), contract_end_date (Avg.datum).

-- 1) Add columns (idempotent)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS employment_form text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS contract_start_date date;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS contract_end_date date;

COMMENT ON COLUMN public.employees.employment_form IS 'HR master: e.g. Visstid - Överenskommen, Provanställd';
COMMENT ON COLUMN public.employees.contract_start_date IS 'HR master: Anst.datum';
COMMENT ON COLUMN public.employees.contract_end_date IS 'HR master: Avg.datum (fixed-term end)';

-- 2) CHECK: contract_end_date >= contract_start_date when both set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_contract_dates_check'
  ) THEN
    ALTER TABLE public.employees
    ADD CONSTRAINT employees_contract_dates_check
    CHECK (
      (contract_start_date IS NULL OR contract_end_date IS NULL)
      OR (contract_end_date >= contract_start_date)
    );
  END IF;
END $$;

-- 3) Index for cockpit "Contracts Ending (next 90 days)" and list filters
CREATE INDEX IF NOT EXISTS idx_employees_org_contract_end_date
  ON public.employees(org_id, contract_end_date)
  WHERE contract_end_date IS NOT NULL;

-- Cockpit metric (prep only, no UI yet): Contracts Ending (next 90 days)
-- Query pattern for future executive-summary or cockpit widget:
--   SELECT id, name, employee_number, contract_end_date, employment_form, employment_status
--   FROM public.employees
--   WHERE org_id = $1
--     AND contract_end_date IS NOT NULL
--     AND contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
--     AND employment_status IN ('ACTIVE', 'INACTIVE')
--     [AND (site_id IS NULL OR site_id = $2)]  -- when site-scoped
--   ORDER BY contract_end_date ASC;
--
-- Sample verification (run after migration; replace :org_id / :site_id as needed):
--   SELECT id, name, employee_number, contract_start_date, contract_end_date, employment_form, employment_status
--   FROM public.employees
--   WHERE org_id = :org_id
--     AND contract_end_date IS NOT NULL
--     AND contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
--     AND employment_status IN ('ACTIVE', 'INACTIVE')
--   ORDER BY contract_end_date
--   LIMIT 4;
