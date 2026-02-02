-- Add employees.org_unit_id (FK to org_units) for Organization Overview.
-- Backfill existing employees into a sensible default unit per org.
-- Idempotent: safe to re-run.

-- 1. Add column if not exists
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS org_unit_id uuid NULL;

-- 2. FK to org_units(id), ON DELETE SET NULL (only if constraint not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass
      AND conname = 'employees_org_unit_id_fkey'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_org_unit_id_fkey
      FOREIGN KEY (org_unit_id) REFERENCES public.org_units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Index for tenant-scoped lookups (org_id, org_unit_id)
CREATE INDEX IF NOT EXISTS idx_employees_org_id_org_unit_id
  ON public.employees(org_id, org_unit_id);

-- 4. Backfill: for each org with employees that have org_unit_id IS NULL,
--    set org_unit_id to a default unit for that org.
--    Default unit priority:
--    - Prefer root unit (parent_id IS NULL) with name ILIKE '%Spaljisten%'
--    - Else any root unit (parent_id IS NULL)
--    - Else any org_unit for the org
DO $$
DECLARE
  v_org_id uuid;
  v_unit_id uuid;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT e.org_id
    FROM public.employees e
    WHERE e.org_id IS NOT NULL
      AND e.org_unit_id IS NULL
  LOOP
    SELECT id INTO v_unit_id
    FROM public.org_units
    WHERE org_id = v_org_id
    ORDER BY
      (CASE WHEN parent_id IS NULL AND name ILIKE '%Spaljisten%' THEN 0
            WHEN parent_id IS NULL THEN 1
            ELSE 2 END),
      id
    LIMIT 1;

    IF v_unit_id IS NOT NULL THEN
      UPDATE public.employees
      SET org_unit_id = v_unit_id
      WHERE org_id = v_org_id AND org_unit_id IS NULL;
    END IF;
  END LOOP;
END $$;
