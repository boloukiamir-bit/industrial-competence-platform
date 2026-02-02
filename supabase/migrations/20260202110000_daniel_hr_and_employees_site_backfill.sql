-- P0: Ensure Daniel (HR) has Spaljisten membership + profile; backfill employees.site_id for Org Overview count.
-- Spaljisten org_id = a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- Spaljisten site_id = 2d3f16a8-dc34-4c66-8f7c-2481a84bffba
-- Daniel email = daniel.buhre@spaljisten.se

-- 1) Ensure profile exists for Daniel with active_org_id and active_site_id (from auth.users)
INSERT INTO public.profiles (id, email, active_org_id, active_site_id)
SELECT id, email,
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  '2d3f16a8-dc34-4c66-8f7c-2481a84bffba'::uuid
FROM auth.users WHERE email = 'daniel.buhre@spaljisten.se'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  active_org_id = EXCLUDED.active_org_id,
  active_site_id = EXCLUDED.active_site_id;

-- 2) Ensure membership in Spaljisten org with role=hr, status=active
INSERT INTO public.memberships (org_id, user_id, role, status)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  id,
  'hr',
  'active'
FROM auth.users
WHERE email = 'daniel.buhre@spaljisten.se'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'hr', status = 'active';

-- 3) Backfill employees.site_id for Spaljisten where site_id IS NULL (so Org Overview count matches Employees)
UPDATE public.employees
SET site_id = '2d3f16a8-dc34-4c66-8f7c-2481a84bffba'::uuid
WHERE org_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
  AND site_id IS NULL;
