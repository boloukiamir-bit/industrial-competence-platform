-- P1.10 Compliance action packs (pilot): seed hr_templates with category license / medical / contract.
-- Content shape: { description, steps: [ { order, title, note } ] }. No schema changes.

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'ACTION_PACK_LICENSE_RENEWAL',
  'License renewal checklist',
  'license',
  '{"description":"Steps for handling employee license renewal.","steps":[{"order":1,"title":"Verify current license validity","note":"Check expiry date in system."},{"order":2,"title":"Send renewal request to employee","note":"Use standard template if available."},{"order":3,"title":"Collect and file new certificate","note":"Store in personnel file."},{"order":4,"title":"Update compliance record","note":"Set new valid_to date."}]}'::jsonb,
  true
FROM public.organizations o
WHERE o.slug = 'spaljisten'
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'ACTION_PACK_MEDICAL_CHECK',
  'Medical check follow-up',
  'medical',
  '{"description":"Follow-up steps after occupational health assessment.","steps":[{"order":1,"title":"Book medical check","note":"Coordinate with occupational health provider."},{"order":2,"title":"Send appointment details to employee","note":"Include date, time, location."},{"order":3,"title":"Receive and file fit-for-work statement","note":"Store in confidential file."},{"order":4,"title":"Update employee record","note":"Note any restrictions or accommodations."}]}'::jsonb,
  true
FROM public.organizations o
WHERE o.slug = 'spaljisten'
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'ACTION_PACK_CONTRACT_UPDATE',
  'Contract update checklist',
  'contract',
  '{"description":"Steps for contract changes or addendum.","steps":[{"order":1,"title":"Draft change or addendum","note":"Legal review if required."},{"order":2,"title":"Send to employee for review","note":"Allow reasonable time."},{"order":3,"title":"Sign and countersign","note":"Both parties, dated."},{"order":4,"title":"File signed copy","note":"Update HR system and personnel file."}]}'::jsonb,
  true
FROM public.organizations o
WHERE o.slug = 'spaljisten'
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();
