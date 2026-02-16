-- Compliance Catalog v1: Daniel pilot categories + idempotent seed.
-- 1) Extend category enum to include work_environment, medical_control, medical_training, customer_requirement, sustainability.
-- 2) Seed catalog items per org (upsert by org_id, code). No hardcoded org/site ids.

-- Extend category constraint (drop and recreate)
ALTER TABLE public.compliance_catalog DROP CONSTRAINT IF EXISTS compliance_catalog_category_check;
ALTER TABLE public.compliance_catalog ADD CONSTRAINT compliance_catalog_category_check CHECK (
  category IN (
    'license', 'medical', 'contract',
    'work_environment', 'medical_control', 'medical_training', 'customer_requirement', 'sustainability'
  )
);

-- Idempotent seed: one row per (org_id, code) for all organizations
INSERT INTO public.compliance_catalog (org_id, category, code, name, is_active, updated_at)
SELECT o.id, v.category, v.code, v.name, true, now()
FROM public.organizations o
CROSS JOIN (VALUES
  ('work_environment', 'BAM_GRUND', 'BAM Grund'),
  ('work_environment', 'BAM_FORTS', 'BAM Fortsättning'),
  ('work_environment', 'FIRE_SAFETY', 'Brandskydd'),
  ('work_environment', 'FIRST_AID', 'Första hjälp'),
  ('work_environment', 'CPR', 'CPR'),
  ('medical_control', 'NIGHT_EXAM', 'Nattarbetsundersökning'),
  ('medical_control', 'EPOXY_EXAM', 'Epoxyundersökning'),
  ('medical_control', 'HAND_INTENSIVE_EXAM', 'Handintensiv undersökning'),
  ('medical_control', 'HEARING_TEST', 'Hörseltest'),
  ('medical_control', 'VISION_TEST', 'Synundersökning'),
  ('medical_control', 'GENERAL_HEALTH', 'Allmän hälsokontroll'),
  ('medical_training', 'EPOXY_TRAINING', 'Epoxyutbildning'),
  ('customer_requirement', 'IKEA_IWAY', 'IKEA IWAY'),
  ('customer_requirement', 'IKEA_BUSINESS_ETHICS', 'IKEA Business Ethics'),
  ('sustainability', 'FSC', 'FSC')
) AS v(category, code, name)
ON CONFLICT (org_id, code) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  updated_at = EXCLUDED.updated_at;

COMMENT ON TABLE public.compliance_catalog IS 'Compliance catalog per org; Daniel pilot adds work_environment, medical_control, medical_training, customer_requirement, sustainability.';
