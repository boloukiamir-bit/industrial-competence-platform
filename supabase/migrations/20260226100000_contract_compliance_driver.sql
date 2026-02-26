-- Contract compliance driver (Daniel P0): deterministic status, HR Inbox, cockpit aggregation.
-- Employees table already has: contract_start_date, contract_end_date, employment_type, employment_status (from prior migrations).
-- This migration adds a view to compute contract status per employee for the active org/site.

-- 1) Ensure employees has contract_start_date if not already (already in 20260225180000_fixed_term_contracts.sql)
-- No-op if columns exist.

-- 2) View: v_employee_contract_status
-- Deterministic rules (UTC date-only):
--   - employment_status != 'ACTIVE' => GO (contract does not block)
--   - contract_end_date IS NULL => WARNING (CONTRACT_MISSING_END_DATE)
--   - contract_end_date < today_utc => ILLEGAL (CONTRACT_EXPIRED)
--   - contract_end_date in [today_utc, today_utc+30] => WARNING (CONTRACT_EXPIRING_SOON)
--   - contract_end_date > today_utc+30 => GO
CREATE OR REPLACE VIEW public.v_employee_contract_status AS
SELECT
  e.id AS employee_id,
  e.org_id,
  e.site_id,
  e.name AS employee_name,
  e.contract_end_date,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN 'GO'
    WHEN e.contract_end_date IS NULL THEN 'WARNING'
    WHEN e.contract_end_date < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'ILLEGAL'
    WHEN e.contract_end_date <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'WARNING'
    ELSE 'GO'
  END AS status,
  CASE
    WHEN (e.employment_status IS NULL OR e.employment_status <> 'ACTIVE') THEN NULL
    WHEN e.contract_end_date IS NULL THEN 'CONTRACT_MISSING_END_DATE'
    WHEN e.contract_end_date < ((current_timestamp AT TIME ZONE 'UTC')::date) THEN 'CONTRACT_EXPIRED'
    WHEN e.contract_end_date <= ((current_timestamp AT TIME ZONE 'UTC')::date + INTERVAL '30 days')::date THEN 'CONTRACT_EXPIRING_SOON'
    ELSE NULL
  END AS reason_code,
  CASE
    WHEN e.contract_end_date IS NULL THEN NULL
    ELSE (e.contract_end_date - ((current_timestamp AT TIME ZONE 'UTC')::date))::integer
  END AS days_to_expiry
FROM public.employees e;

COMMENT ON VIEW public.v_employee_contract_status IS 'Contract compliance status per employee: GO/WARNING/ILLEGAL, reason_code, days_to_expiry. Used by HR Inbox (contract tab) and cockpit aggregation.';

-- RLS: view uses underlying employees; select policy on employees is org-scoped. View does not add RLS (reads through employees).
-- API will filter by org_id and optionally site_id when querying this view.
