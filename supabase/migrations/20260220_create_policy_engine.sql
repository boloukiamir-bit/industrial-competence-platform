-- Policy Engine: policy_templates (industry seeds) and unit_policy (unit-level assignment).
-- STRATEGY_LOCK Phase B – Policy Engine foundation.

-- =============================================================================
-- 1) policy_templates
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.policy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_type text NOT NULL,
  version integer NOT NULL,
  weight_config jsonb NOT NULL,
  threshold_config jsonb NOT NULL,
  penalty_config jsonb NOT NULL,
  feasibility_config jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_templates_industry_version
  ON public.policy_templates(industry_type, version);

COMMENT ON TABLE public.policy_templates IS 'Industry policy templates for readiness weights, thresholds, penalties, feasibility.';

-- =============================================================================
-- 2) unit_policy (references org_units; unit = business unit / site)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.unit_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.policy_templates(id),
  version integer NOT NULL,
  active boolean DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_policy_unit_id ON public.unit_policy(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_policy_template_id ON public.unit_policy(template_id);
CREATE INDEX IF NOT EXISTS idx_unit_policy_active ON public.unit_policy(active) WHERE active = true;

COMMENT ON TABLE public.unit_policy IS 'Per-unit policy assignment from policy_templates; supports versioning and effective_from.';

-- =============================================================================
-- 3) Seed 4 industry templates (version 1)
-- =============================================================================
INSERT INTO public.policy_templates (
  industry_type,
  version,
  weight_config,
  threshold_config,
  penalty_config,
  feasibility_config
) VALUES
-- Heavy Manufacturing
(
  'Heavy Manufacturing',
  1,
  '{"skill": 0.45, "experience": 0.25, "absence": 0.20, "compliance": 0.10}'::jsonb,
  '{"go": 82, "warning": 70, "min_skill": 0.60, "min_experience": 0.50}'::jsonb,
  '{"compliance_warning_penalty": 0.20, "max_feasibility_impact": 0.30}'::jsonb,
  '{"enabled": true, "min_modifier": 0.70}'::jsonb
),
-- Pharma/Food (stricter compliance, higher compliance weight)
(
  'Pharma/Food',
  1,
  '{"skill": 0.35, "experience": 0.20, "absence": 0.15, "compliance": 0.30}'::jsonb,
  '{"go": 88, "warning": 75, "min_skill": 0.65, "min_experience": 0.55}'::jsonb,
  '{"compliance_warning_penalty": 0.35, "max_feasibility_impact": 0.40}'::jsonb,
  '{"enabled": true, "min_modifier": 0.75}'::jsonb
),
-- Energy (safety/compliance emphasis)
(
  'Energy',
  1,
  '{"skill": 0.40, "experience": 0.25, "absence": 0.15, "compliance": 0.20}'::jsonb,
  '{"go": 85, "warning": 72, "min_skill": 0.62, "min_experience": 0.52}'::jsonb,
  '{"compliance_warning_penalty": 0.28, "max_feasibility_impact": 0.35}'::jsonb,
  '{"enabled": true, "min_modifier": 0.72}'::jsonb
),
-- Enterprise Default (balanced)
(
  'Enterprise Default',
  1,
  '{"skill": 0.40, "experience": 0.25, "absence": 0.20, "compliance": 0.15}'::jsonb,
  '{"go": 80, "warning": 68, "min_skill": 0.58, "min_experience": 0.48}'::jsonb,
  '{"compliance_warning_penalty": 0.18, "max_feasibility_impact": 0.28}'::jsonb,
  '{"enabled": true, "min_modifier": 0.68}'::jsonb
)
ON CONFLICT (industry_type, version) DO NOTHING;
