-- =============================================================================
-- DEACTIVATE DEMO/TEST EMPLOYEES - Spaljisten org (idempotent)
-- =============================================================================
-- Run in Supabase SQL Editor. Targets org by slug = 'spaljisten'.
-- Prefer: soft-delete (is_active = false). Optional: hard-delete with cleanup.
-- =============================================================================

-- 1) Soft-deactivate demo/test employees (idempotent: safe to run multiple times)
UPDATE public.employees
SET is_active = false
WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
  AND is_active = true
  AND (
    employee_number LIKE 'E9%'
    OR employee_number LIKE 'TEST%'
    OR employee_number LIKE 'E100%'
    OR name ILIKE '%Test%'
  );

-- =============================================================================
-- Optional: hard-delete demo employees and dependent rows (uncomment if needed)
-- =============================================================================
-- Step A: pl_attendance (by employee_code in Spaljisten org)
-- DELETE FROM public.pl_attendance
-- WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--   AND employee_code IN (
--     SELECT employee_number FROM public.employees e
--     WHERE e.org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--       AND (e.employee_number LIKE 'E9%' OR e.employee_number LIKE 'TEST%' OR e.employee_number LIKE 'E100%' OR e.name ILIKE '%Test%')
--   );
-- Step B: pl_assignment_segments
-- DELETE FROM public.pl_assignment_segments
-- WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--   AND employee_code IN (
--     SELECT employee_number FROM public.employees e
--     WHERE e.org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--       AND (e.employee_number LIKE 'E9%' OR e.employee_number LIKE 'TEST%' OR e.employee_number LIKE 'E100%' OR e.name ILIKE '%Test%')
--   );
-- Step C: employee_skills
-- DELETE FROM public.employee_skills
-- WHERE employee_id IN (
--   SELECT id FROM public.employees e
--   WHERE e.org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--     AND (e.employee_number LIKE 'E9%' OR e.employee_number LIKE 'TEST%' OR e.employee_number LIKE 'E100%' OR e.name ILIKE '%Test%')
-- );
-- Step D: employees
-- DELETE FROM public.employees
-- WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--   AND (employee_number LIKE 'E9%' OR employee_number LIKE 'TEST%' OR employee_number LIKE 'E100%' OR name ILIKE '%Test%');

-- Verify (run after cleanup): active count for Spaljisten
-- SELECT o.slug, COUNT(*) FILTER (WHERE e.is_active = true) AS active_employees, COUNT(*) AS total
-- FROM public.organizations o LEFT JOIN public.employees e ON e.org_id = o.id
-- WHERE o.slug = 'spaljisten' GROUP BY o.id, o.slug;
en employees; CASCADE may apply elsewhere)
-- DELETE FROM public.employee_skills
-- WHERE employee_id IN (
--   SELECT id FROM public.employees e
--   WHERE e.org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--     AND (e.employee_number LIKE 'E9%' OR e.employee_number LIKE 'TEST%' OR e.employee_number LIKE 'E100%' OR e.name ILIKE '%Test%')
-- );

-- Step D: employees
-- DELETE FROM public.employees
-- WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1)
--   AND (employee_number LIKE 'E9%' OR employee_number LIKE 'TEST%' OR employee_number LIKE 'E100%' OR name ILIKE '%Test%');

-- =============================================================================
-- Verify: active employee count for Spaljisten (run after cleanup)
-- =============================================================================
-- SELECT
--   o.slug,
--   COUNT(*) FILTER (WHERE e.is_active = true) AS active_employees,
--   COUNT(*) AS total_employees
-- FROM public.organizations o
-- LEFT JOIN public.employees e ON e.org_id = o.id
-- WHERE o.slug = 'spaljisten'
-- GROUP BY o.id, o.slug;
