-- Competence Matrix DB check and optional purge
-- Use active_org_id from your session (e.g. from profiles.active_org_id for current user)

-- 1) List skills catalog for an org (replace :active_org_id with actual UUID)
SELECT id, org_id, code, name, category
FROM public.skills
WHERE org_id = :active_org_id
ORDER BY category, code;

-- 2) Detect demo skills in DB for this org (codes that match legacy demo set)
SELECT id, org_id, code, name, category
FROM public.skills
WHERE org_id = :active_org_id
  AND code IN ('PRESS_A', 'PRESS_B', '5S', 'SAFETY_BASIC', 'TRUCK_A1')
ORDER BY code;

-- 3) Count employee_skill_ratings for this org (via skill.org_id)
SELECT s.org_id, COUNT(es.id) AS rating_count
FROM public.employee_skills es
JOIN public.skills s ON s.id = es.skill_id
WHERE s.org_id = :active_org_id
GROUP BY s.org_id;

-- 4) Optional: safe purge of demo skills for ONE org only (run only when intended)
-- Step A: delete ratings that reference demo skills
DELETE FROM public.employee_skills
WHERE skill_id IN (
  SELECT id FROM public.skills
  WHERE org_id = :active_org_id
    AND code IN ('PRESS_A', 'PRESS_B', '5S', 'SAFETY_BASIC', 'TRUCK_A1')
);
-- Step B: delete demo skills for this org
DELETE FROM public.skills
WHERE org_id = :active_org_id
  AND code IN ('PRESS_A', 'PRESS_B', '5S', 'SAFETY_BASIC', 'TRUCK_A1');

-- Usage: In Supabase SQL Editor, replace :active_org_id with a literal, e.g.:
-- WHERE org_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
