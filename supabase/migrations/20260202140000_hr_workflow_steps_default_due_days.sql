-- Set default_due_days for Spaljisten ONBOARDING and OFFBOARDING steps (idempotent).
-- ONBOARDING: contract_signed 0, id_card 3, safety_intro 1, system_access 2, medical_check_if_required 7
-- OFFBOARDING: return_badge 0, revoke_access 0, exit_interview 7, final_payroll 14

DO $$
DECLARE
  v_org_id uuid;
  w_onb_id uuid;
  w_off_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'spaljisten' LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO w_onb_id FROM public.hr_workflows WHERE org_id = v_org_id AND code = 'ONBOARDING' LIMIT 1;
  IF w_onb_id IS NOT NULL THEN
    UPDATE public.hr_workflow_steps SET default_due_days = 0 WHERE workflow_id = w_onb_id AND code = 'contract_signed';
    UPDATE public.hr_workflow_steps SET default_due_days = 3 WHERE workflow_id = w_onb_id AND code = 'id_card';
    UPDATE public.hr_workflow_steps SET default_due_days = 1 WHERE workflow_id = w_onb_id AND code = 'safety_intro';
    UPDATE public.hr_workflow_steps SET default_due_days = 2 WHERE workflow_id = w_onb_id AND code = 'system_access';
    UPDATE public.hr_workflow_steps SET default_due_days = 7 WHERE workflow_id = w_onb_id AND code = 'medical_check_if_required';
  END IF;

  SELECT id INTO w_off_id FROM public.hr_workflows WHERE org_id = v_org_id AND code = 'OFFBOARDING' LIMIT 1;
  IF w_off_id IS NOT NULL THEN
    UPDATE public.hr_workflow_steps SET default_due_days = 0 WHERE workflow_id = w_off_id AND code = 'return_badge';
    UPDATE public.hr_workflow_steps SET default_due_days = 0 WHERE workflow_id = w_off_id AND code = 'revoke_access';
    UPDATE public.hr_workflow_steps SET default_due_days = 7 WHERE workflow_id = w_off_id AND code = 'exit_interview';
    UPDATE public.hr_workflow_steps SET default_due_days = 14 WHERE workflow_id = w_off_id AND code = 'final_payroll';
  END IF;

  RAISE NOTICE 'HR workflow steps default_due_days updated for Spaljisten';
END;
$$;
