-- =============================================================================
-- SETUP SPALJISTEN ORGANIZATION - Copy-paste ready SQL
-- =============================================================================
-- Run this in Supabase SQL Editor step by step
-- Replace placeholders with actual values from previous queries
-- =============================================================================

-- =============================================================================
-- STEP 1: Hämta din auth user_id
-- =============================================================================
-- Kör detta först för att hitta din user_id:
SELECT 
  id as user_id, 
  email,
  created_at
FROM auth.users
WHERE email = 'amir@bolouki.se';

-- Kopiera user_id från resultatet ovan och använd i steg 3 och 4 nedan
-- Exempel: '12345678-1234-1234-1234-123456789abc'


-- =============================================================================
-- STEP 2: Skapa Spaljisten Organization
-- =============================================================================
-- VIKTIGT: created_by är NOT NULL och måste sättas!
-- Ersätt <USER_ID> med user_id från Steg 1
-- 
-- Först, kontrollera om org redan finns:
SELECT id, name, slug, created_by FROM public.organizations WHERE slug = 'spaljisten';

-- Om den inte finns, skapa den:
-- IMPORTANT: Replace <USER_ID> with the user_id from Step 1
INSERT INTO public.organizations (name, slug, created_by)
VALUES ('Spaljisten AB', 'spaljisten', '<USER_ID>'::uuid)  -- Ersätt <USER_ID> med faktiskt user_id från Steg 1
ON CONFLICT (slug) DO NOTHING
RETURNING id, name, slug, created_by;

-- Kopiera id från resultatet ovan och använd som <ORG_ID> i steg 3 och 4 nedan
-- Exempel: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'


-- =============================================================================
-- STEP 3: Skapa Site (org_unit med type='site')
-- =============================================================================
-- Ersätt <ORG_ID> med id från steg 2
INSERT INTO public.org_units (org_id, name, code, type)
VALUES (
  '<ORG_ID>',  -- Ersätt med faktiskt org_id från steg 2
  'Spaljisten AB',
  'SPALJISTEN',
  'site'
)
RETURNING id, name, type;

-- Kopiera id från resultatet om du behöver site_id senare
-- Exempel: 'f1f2f3f4-f5f6-f7f8-f9f0-f1f2f3f4f5f6'


-- =============================================================================
-- STEP 4: Skapa Membership (gör dig till admin/owner)
-- =============================================================================
-- Ersätt <ORG_ID> med id från steg 2
-- Ersätt <USER_ID> med user_id från steg 1
INSERT INTO public.memberships (org_id, user_id, role, status)
VALUES (
  '<ORG_ID>',      -- Ersätt med faktiskt org_id från steg 2
  '<USER_ID>',     -- Ersätt med faktiskt user_id från steg 1
  'admin',         -- 'admin' ger full access (alternativ: 'hr', 'manager', 'user')
  'active'
)
ON CONFLICT (org_id, user_id) 
DO UPDATE SET 
  role = 'admin',
  status = 'active'
RETURNING org_id, user_id, role, status;


-- =============================================================================
-- STEP 5: Verifiera setup
-- =============================================================================
-- Kör detta för att verifiera att allt är korrekt:
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

-- Du bör se en rad med role='admin' och status='active'


-- =============================================================================
-- STEP 6: (Valfritt) Sätt org_id på befintliga employees
-- =============================================================================
-- Om du har employees som saknar org_id, sätt dem till din nya org:
-- VARNING: Kör detta ENDAST om du är säker på att alla employees ska tillhöra Spaljisten
-- 
-- UPDATE public.employees
-- SET org_id = '<ORG_ID>'  -- Ersätt med faktiskt org_id från steg 2
-- WHERE org_id IS NULL
--   AND employee_number NOT LIKE 'DEMO%'  -- Exkludera demo employees om de finns
-- RETURNING id, name, employee_number, org_id;

-- Verifiera innan du kör UPDATE:
-- SELECT COUNT(*) as employees_without_org
-- FROM public.employees
-- WHERE org_id IS NULL;


-- =============================================================================
-- STEP 7: (Valfritt) Rensa demo employees från din org
-- =============================================================================
-- Om du har demo employees i din org som du vill ta bort:
-- 
-- Först, se vilka employees som finns:
-- SELECT id, name, employee_number, org_id, is_active, created_at
-- FROM public.employees
-- WHERE org_id = '<ORG_ID>'  -- Ersätt med faktiskt org_id
-- ORDER BY created_at;
--
-- Ta bort demo employees (anpassa WHERE-villkoren efter dina behov):
-- DELETE FROM public.employees
-- WHERE org_id = '<ORG_ID>'  -- Ersätt med faktiskt org_id
--   AND (
--     employee_number LIKE 'DEMO%' 
--     OR employee_number LIKE 'TEST%'
--     OR name LIKE '%Demo%'
--     OR created_at < '2026-01-01'  -- Anpassa datum efter behov
--   );


-- =============================================================================
-- KLAR! 
-- =============================================================================
-- Efter detta bör du:
-- 1. Logga ut och in igen i appen
-- 2. Välj "Spaljisten AB" som aktiv organisation
-- 3. Dashboard headcount bör nu visa korrekt antal (filtrerat på din org)
-- 4. Line Overview bör bara visa linjer från din org
-- =============================================================================
