-- Add site_id to employees for org/units and employees list site filtering (active_site_id).
-- GET /api/org/units and GET /api/employees filter by site_id when profile.active_site_id is set.
-- Nullable uuid (no FK) so it can match profile.active_site_id (organizations or org_units depending on setup).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS site_id uuid;

CREATE INDEX IF NOT EXISTS idx_employees_site_id ON public.employees(site_id);
