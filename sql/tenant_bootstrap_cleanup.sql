-- =============================================================================
-- P0 TENANT BOOTSTRAP + DATA HYGIENE - Safe Cleanup Script
-- =============================================================================
-- Run this in Supabase SQL Editor step by step
-- DO NOT run all at once - verify each step before proceeding
-- =============================================================================

-- =============================================================================
-- STEP 1: Find your user_id
-- =============================================================================
SELECT 
  id as user_id, 
  email,
  created_at
FROM auth.users
WHERE email = 'amir@bolouki.se';

-- Copy the user_id from above result
-- Example: '12345678-1234-1234-1234-123456789abc'


-- =============================================================================
-- STEP 2: Create Spaljisten Organization
-- =============================================================================
-- Check if org already exists
SELECT id, name, slug, created_by FROM public.organizations WHERE slug = 'spaljisten';

-- If not exists, create it:
-- IMPORTANT: Replace <USER_ID> with the user_id from Step 1
-- The created_by column is NOT NULL and references auth.users(id)
INSERT INTO public.organizations (name, slug, created_by)
VALUES ('Spaljisten AB', 'spaljisten', '<USER_ID>'::uuid)  -- Replace <USER_ID> with actual user_id from Step 1
ON CONFLICT (slug) DO NOTHING
RETURNING id, name, slug, created_by;

-- Copy the org_id from result
-- Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'


-- =============================================================================
-- STEP 3: Create Site (org_unit with type='site')
-- =============================================================================
-- Replace <ORG_ID> with actual org_id from Step 2
INSERT INTO public.org_units (org_id, name, code, type)
VALUES (
  '<ORG_ID>',  -- Replace with actual org_id
  'Spaljisten AB',
  'SPALJISTEN',
  'site'
)
ON CONFLICT DO NOTHING
RETURNING id, name, type;


-- =============================================================================
-- STEP 4: Create Membership (make user admin)
-- =============================================================================
-- Replace <ORG_ID> and <USER_ID> with actual values
INSERT INTO public.memberships (org_id, user_id, role, status)
VALUES (
  '<ORG_ID>',      -- Replace with org_id from Step 2
  '<USER_ID>',      -- Replace with user_id from Step 1
  'admin',          -- 'admin' gives full access
  'active'
)
ON CONFLICT (org_id, user_id) 
DO UPDATE SET 
  role = 'admin',
  status = 'active'
RETURNING org_id, user_id, role, status;


-- =============================================================================
-- STEP 5: Verify Setup
-- =============================================================================
-- Check that everything is set up correctly:
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.slug,
  m.user_id,
  m.role,
  m.status,
  u.email
FROM public.organizations o
JOIN public.memberships m ON m.org_id = o.id
JOIN auth.users u ON u.id = m.user_id
WHERE o.slug = 'spaljisten'
  AND u.email = 'amir@bolouki.se';

-- Should return 1 row with role='admin' and status='active'


-- =============================================================================
-- STEP 6: Identify Demo Data
-- =============================================================================
-- Check what employees exist without org_id or with wrong org_id
SELECT 
  COUNT(*) as total_employees,
  COUNT(*) FILTER (WHERE org_id IS NULL) as no_org_id,
  COUNT(*) FILTER (WHERE org_id != '<ORG_ID>') as wrong_org_id,  -- Replace <ORG_ID>
  COUNT(*) FILTER (WHERE org_id = '<ORG_ID>') as correct_org_id  -- Replace <ORG_ID>
FROM public.employees;

-- Check for demo employees by pattern
SELECT 
  id,
  name,
  employee_number,
  org_id,
  is_active,
  created_at
FROM public.employees
WHERE org_id IS NULL
   OR employee_number LIKE 'DEMO%'
   OR employee_number LIKE 'TEST%'
   OR name LIKE '%Demo%'
ORDER BY created_at;


-- =============================================================================
-- STEP 7: Create "Demo" Organization for Old Data
-- =============================================================================
-- This preserves demo data in a separate org instead of deleting it
-- IMPORTANT: Replace <USER_ID> with the user_id from Step 1 (or use a system user)
INSERT INTO public.organizations (name, slug, created_by)
VALUES ('Demo Data (Legacy)', 'demo-legacy', '<USER_ID>'::uuid)  -- Replace <USER_ID> with actual user_id
ON CONFLICT (slug) DO NOTHING
RETURNING id, name, slug, created_by;

-- Copy the demo_org_id from result
-- Example: 'd1d2d3d4-d5d6-d7d8-d9d0-d1d2d3d4d5d6'


-- =============================================================================
-- STEP 8: Move Demo Data to Demo Org
-- =============================================================================
-- Replace <DEMO_ORG_ID> with demo org_id from Step 7
-- This moves employees without org_id to the demo org
UPDATE public.employees
SET org_id = '<DEMO_ORG_ID>'  -- Replace with demo org_id
WHERE org_id IS NULL
  AND (
    employee_number LIKE 'DEMO%'
    OR employee_number LIKE 'TEST%'
    OR name LIKE '%Demo%'
    OR created_at < '2026-01-20'  -- Adjust date as needed
  )
RETURNING id, name, employee_number, org_id;

-- Verify the move:
SELECT COUNT(*) as demo_employees_count
FROM public.employees
WHERE org_id = '<DEMO_ORG_ID>';  -- Replace with demo org_id


-- =============================================================================
-- STEP 9: Set org_id on Remaining Employees (if any)
-- =============================================================================
-- If you have employees that should belong to Spaljisten but have NULL org_id:
-- Replace <ORG_ID> with Spaljisten org_id from Step 2
-- 
-- WARNING: Only run this if you're sure these employees belong to Spaljisten
-- 
-- UPDATE public.employees
-- SET org_id = '<ORG_ID>'  -- Replace with Spaljisten org_id
-- WHERE org_id IS NULL
--   AND employee_number NOT LIKE 'DEMO%'
--   AND employee_number NOT LIKE 'TEST%'
--   AND name NOT LIKE '%Demo%'
-- RETURNING id, name, employee_number, org_id;


-- =============================================================================
-- STEP 10: Verify Final State
-- =============================================================================
-- Check Spaljisten employees:
SELECT 
  COUNT(*) as spaljisten_employees,
  COUNT(*) FILTER (WHERE is_active = true) as active_employees
FROM public.employees
WHERE org_id = '<ORG_ID>';  -- Replace with Spaljisten org_id

-- Check all orgs and their employee counts:
SELECT 
  o.id,
  o.name,
  o.slug,
  COUNT(e.id) as employee_count,
  COUNT(e.id) FILTER (WHERE e.is_active = true) as active_count
FROM public.organizations o
LEFT JOIN public.employees e ON e.org_id = o.id
GROUP BY o.id, o.name, o.slug
ORDER BY o.created_at;


-- =============================================================================
-- STEP 11: Clean Up Import Runs (Optional)
-- =============================================================================
-- If you want to clean up old import runs:
-- 
-- SELECT 
--   id,
--   organization_id,
--   created_at,
--   employee_count
-- FROM public.employee_import_runs
-- WHERE organization_id = '<ORG_ID>'  -- Replace with org_id
-- ORDER BY created_at DESC;
--
-- Delete old import runs if needed (be careful!):
-- DELETE FROM public.employee_import_runs
-- WHERE organization_id = '<ORG_ID>'  -- Replace with org_id
--   AND created_at < '2026-01-24';  -- Adjust date as needed


-- =============================================================================
-- COMPLETION CHECKLIST
-- =============================================================================
-- ✅ Step 1: Found user_id
-- ✅ Step 2: Created Spaljisten org
-- ✅ Step 3: Created site (org_unit)
-- ✅ Step 4: Created membership (admin role)
-- ✅ Step 5: Verified setup
-- ✅ Step 6: Identified demo data
-- ✅ Step 7: Created Demo org
-- ✅ Step 8: Moved demo data to Demo org
-- ✅ Step 9: Set org_id on remaining employees (if needed)
-- ✅ Step 10: Verified final state
--
-- After completion:
-- 1. Log out completely from the app
-- 2. Log in as amir@bolouki.se
-- 3. Should auto-select Spaljisten org
-- 4. Dashboard should show correct headcount
-- 5. Import should work correctly
-- =============================================================================
