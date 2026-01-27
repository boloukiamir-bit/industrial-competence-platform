-- Create documents table for employee documents and certificates
-- Supports tenant isolation via org_id and RLS policies
-- Required for HR Tasks "Expiring Soon" feature

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('contract', 'handbook', 'policy', 'certificate', 'employee_handbook', 'manager_handbook', 'review_protocol', 'other')),
  title text NOT NULL,
  url text NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_valid_to ON public.documents(valid_to);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_org_employee ON public.documents(org_id, employee_id);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: HR admins can read/write their org's documents
CREATE POLICY documents_select ON public.documents
  FOR SELECT USING (public.is_org_admin(org_id));

CREATE POLICY documents_insert ON public.documents
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY documents_update ON public.documents
  FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY documents_delete ON public.documents
  FOR DELETE USING (public.is_org_admin(org_id));

-- Grant permissions to authenticated users (required for RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
