-- Canonical line membership: employees.line_code for filtering/grouping/joins; employees.line remains for display.
-- stations.line stores line code; all filtering uses employees.line_code to match.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS line_code text;

UPDATE public.employees
SET line_code = COALESCE(TRIM(line), '')
WHERE line_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_line_code ON public.employees(org_id, line_code)
  WHERE line_code IS NOT NULL AND line_code <> '';

COMMENT ON COLUMN public.employees.line_code IS 'Canonical line code for filtering/grouping; matches stations.line. Use for all business logic.';
COMMENT ON COLUMN public.employees.line IS 'Display label for line (optional); prefer line_code for filters and joins.';
