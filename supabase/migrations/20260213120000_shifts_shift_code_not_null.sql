-- Unify shifts schema: shift_code is canonical.
-- Backfill shift_code from shift_type where missing, then enforce NOT NULL.

ALTER TABLE public.shifts
  ALTER COLUMN shift_type DROP NOT NULL;

UPDATE public.shifts
SET shift_code = shift_type
WHERE (shift_code IS NULL OR shift_code = '') AND shift_type IS NOT NULL;

-- Dedupe: keep shift with most shift_assignments; tie-break newest created_at. Reassign then delete.
CREATE TEMP TABLE tmp_shift_dedupe_map AS
WITH dup_groups AS (
  SELECT org_id, shift_date, shift_code
  FROM public.shifts
  GROUP BY org_id, shift_date, shift_code
  HAVING COUNT(*) > 1
),
shift_assign_counts AS (
  SELECT
    s.id,
    s.org_id,
    s.shift_date,
    s.shift_code,
    s.created_at,
    (SELECT COUNT(*) FROM public.shift_assignments sa WHERE sa.shift_id = s.id) AS assign_cnt
  FROM public.shifts s
  INNER JOIN dup_groups d
    ON d.org_id = s.org_id AND d.shift_date = s.shift_date AND d.shift_code = s.shift_code
),
ranked AS (
  SELECT
    id,
    org_id,
    shift_date,
    shift_code,
    ROW_NUMBER() OVER (
      PARTITION BY org_id, shift_date, shift_code
      ORDER BY assign_cnt DESC, created_at DESC NULLS LAST
    ) AS rn
  FROM shift_assign_counts
),
keepers AS (
  SELECT id AS keeper_id, org_id, shift_date, shift_code FROM ranked WHERE rn = 1
)
SELECT r.id AS shift_id, k.keeper_id
FROM ranked r
INNER JOIN keepers k
  ON k.org_id = r.org_id AND k.shift_date = r.shift_date AND k.shift_code = r.shift_code
WHERE r.rn > 1;

UPDATE public.shift_assignments sa
SET shift_id = m.keeper_id
FROM tmp_shift_dedupe_map m
WHERE sa.shift_id = m.shift_id;

DELETE FROM public.shifts s
USING tmp_shift_dedupe_map m
WHERE s.id = m.shift_id;

DROP TABLE tmp_shift_dedupe_map;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.shifts
    WHERE shift_code IS NULL OR shift_code = ''
  ) THEN
    RAISE EXCEPTION 'shifts.shift_code still NULL/empty after backfill';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shifts
    GROUP BY org_id, shift_date, shift_code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'shifts has duplicate (org_id, shift_date, shift_code)';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS shifts_org_date_code_uniq
  ON public.shifts (org_id, shift_date, shift_code);

ALTER TABLE public.shifts
  ALTER COLUMN shift_code SET NOT NULL;
