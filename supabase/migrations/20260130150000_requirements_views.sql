-- Requirements Leader UI: DB-view driven. Single source of truth for skills catalog and station health.
-- Ensure station_skill_requirements exists (API writes to it); create as view over station_role_requirements if missing.
-- Add unique constraint for upsert (org_id, station_id, skill_id).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'station_role_requirements_org_station_skill_key') THEN
    ALTER TABLE public.station_role_requirements
      ADD CONSTRAINT station_role_requirements_org_station_skill_key UNIQUE (org_id, station_id, skill_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables t
                 WHERE t.table_schema = 'public' AND t.table_name = 'station_skill_requirements') THEN
    CREATE VIEW public.station_skill_requirements AS
    SELECT id, org_id, station_id, skill_id, required_level, is_mandatory, created_at, updated_at
    FROM public.station_role_requirements;
  END IF;
END $$;

-- 1) v_requirement_skill_catalog: skills usable as station requirements (org-scoped)
CREATE OR REPLACE VIEW public.v_requirement_skill_catalog AS
SELECT
  s.id AS skill_id,
  s.code,
  s.name,
  COALESCE(s.category, 'OTHER') AS category,
  s.org_id
FROM public.skills s
WHERE s.org_id IS NOT NULL;

-- 2) v_tomorrows_gaps_station_health: per-station health from requirements + eligibility
-- Uses station_role_requirements (base table; station_skill_requirements may be view over it)
CREATE OR REPLACE VIEW public.v_tomorrows_gaps_station_health AS
WITH req_counts AS (
  SELECT
    r.station_id,
    COUNT(*)::int AS req_skill_count
  FROM public.station_role_requirements r
  WHERE r.org_id IS NOT NULL
  GROUP BY r.station_id
),
eligible_employees AS (
  SELECT DISTINCT
    s.org_id,
    s.line,
    e.id AS employee_id
  FROM public.stations s
  INNER JOIN public.employees e ON e.org_id = s.org_id AND e.is_active = true
  WHERE s.org_id IS NOT NULL AND s.line IS NOT NULL
),
eligible_by_line AS (
  SELECT
    ee.org_id,
    ee.line,
    COUNT(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.station_role_requirements r2
        INNER JOIN public.stations s2 ON s2.id = r2.station_id
          AND s2.org_id = ee.org_id AND s2.line = ee.line
        WHERE r2.org_id = ee.org_id
        AND NOT EXISTS (
          SELECT 1 FROM public.employee_skills es
          WHERE es.employee_id = ee.employee_id
            AND es.skill_id = r2.skill_id
            AND COALESCE(es.level, 0) >= COALESCE(r2.required_level, 1)
        )
      )
    )::int AS eligible_final
  FROM eligible_employees ee
  GROUP BY ee.org_id, ee.line
)
SELECT
  st.id AS station_id,
  st.code AS station_code,
  st.name AS station_name,
  st.line,
  st.org_id,
  COALESCE(rc.req_skill_count, 0)::int AS req_skill_count,
  COALESCE(ebl.eligible_final, 0)::int AS eligible_final,
  CASE
    WHEN COALESCE(rc.req_skill_count, 0) = 0 THEN 'PENDING'
    WHEN COALESCE(ebl.eligible_final, 0) > 0 THEN 'OK'
    ELSE 'NO-GO'
  END AS req_status,
  CASE
    WHEN COALESCE(rc.req_skill_count, 0) = 0 THEN 'REVIEW'
    WHEN COALESCE(ebl.eligible_final, 0) > 0 THEN 'LOW'
    ELSE 'HIGH'
  END AS risk_tier,
  'current'::text AS data_maturity
FROM public.stations st
LEFT JOIN req_counts rc ON rc.station_id = st.id
LEFT JOIN eligible_by_line ebl ON ebl.org_id = st.org_id AND ebl.line = st.line
WHERE st.org_id IS NOT NULL
  AND st.is_active = true
  AND st.line IS NOT NULL;

COMMENT ON VIEW public.v_requirement_skill_catalog IS 'Skills catalog for station requirements; org-scoped.';
COMMENT ON VIEW public.v_tomorrows_gaps_station_health IS 'Per-station health: req_skill_count, eligible_final, req_status, risk_tier from DB.';
