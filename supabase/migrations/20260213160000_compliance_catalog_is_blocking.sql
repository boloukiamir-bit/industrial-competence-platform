-- Compliance blocking policy: mark blocking catalog items.
ALTER TABLE public.compliance_catalog
  ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT false;

-- Backfill blocking categories/codes.
UPDATE public.compliance_catalog
SET is_blocking = true
WHERE is_active = true
  AND (
    category IN ('work_environment', 'medical', 'contract')
    OR code IN ('TRN_CPR_HLR', 'TRN_FIRE_SAFETY', 'TRN_FIRST_AID')
  );

-- Customer requirements (IKEA_*) are non-blocking.
UPDATE public.compliance_catalog
SET is_blocking = false
WHERE is_active = true
  AND code LIKE 'IKEA_%';
