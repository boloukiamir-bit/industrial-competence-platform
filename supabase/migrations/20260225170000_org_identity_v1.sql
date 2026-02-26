-- Org Identity Layer v1: optional logo for organizations; ensure name present.
-- organizations.name already exists (create_organization, org/create route). Add logo_url only.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text NULL;

COMMENT ON COLUMN public.organizations.logo_url IS 'Optional URL for organization logo (header / identity).';
