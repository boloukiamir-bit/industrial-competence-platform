-- Seed Workflow Templates for Demo
-- Replace {ORG_ID} with actual organization ID before running

-- For demo purposes, we'll use a placeholder that should be replaced
-- In production, run this for each org that needs templates

-- Function to seed templates for an org
CREATE OR REPLACE FUNCTION seed_workflow_templates(p_org_id UUID)
RETURNS void AS $$
DECLARE
  v_onboarding_id UUID;
  v_rehab_id UUID;
  v_offboarding_id UUID;
BEGIN
  -- 1. Onboarding - Operator
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (p_org_id, 'Onboarding – Operator', 'Standard onboarding process for new operators', 'onboarding', true)
  RETURNING id INTO v_onboarding_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required) VALUES
  (v_onboarding_id, 1, 'Prepare workstation', 'Set up computer, desk, and access cards', 'hr', 1, true),
  (v_onboarding_id, 2, 'IT account setup', 'Create email, system accounts, and permissions', 'it', 2, true),
  (v_onboarding_id, 3, 'Safety training', 'Complete mandatory safety orientation', 'manager', 3, true),
  (v_onboarding_id, 4, 'Equipment training', 'Train on primary equipment and tools', 'manager', 7, true),
  (v_onboarding_id, 5, 'Meet the team', 'Introduction to team members and key contacts', 'manager', 3, true),
  (v_onboarding_id, 6, 'HR documentation', 'Complete all employment paperwork', 'hr', 5, true),
  (v_onboarding_id, 7, 'First week check-in', 'Manager check-in after first week', 'manager', 7, true),
  (v_onboarding_id, 8, '30-day review', 'Performance review at 30 days', 'manager', 30, true);

  -- 2. Rehab - 30/60/90 plan
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (p_org_id, 'Rehab – 30/60/90 plan', 'Rehabilitation return-to-work plan with checkpoints', 'rehab', true)
  RETURNING id INTO v_rehab_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required) VALUES
  (v_rehab_id, 1, 'Initial assessment', 'Medical assessment and work capacity evaluation', 'hr', 1, true),
  (v_rehab_id, 2, 'Create rehab plan', 'Develop personalized return-to-work plan', 'hr', 3, true),
  (v_rehab_id, 3, 'Workplace adjustments', 'Implement necessary workplace accommodations', 'manager', 7, true),
  (v_rehab_id, 4, '30-day checkpoint', 'Evaluate progress at 30 days', 'hr', 30, true),
  (v_rehab_id, 5, 'Adjust plan if needed', 'Modify plan based on 30-day review', 'hr', 35, false),
  (v_rehab_id, 6, '60-day checkpoint', 'Evaluate progress at 60 days', 'hr', 60, true),
  (v_rehab_id, 7, '90-day final review', 'Final assessment and plan completion', 'hr', 90, true),
  (v_rehab_id, 8, 'Close case', 'Document outcomes and close rehab case', 'hr', 95, true);

  -- 3. Offboarding - Standard
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (p_org_id, 'Offboarding – Standard', 'Standard employee offboarding process', 'offboarding', true)
  RETURNING id INTO v_offboarding_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required) VALUES
  (v_offboarding_id, 1, 'Exit interview', 'Conduct exit interview', 'hr', 1, true),
  (v_offboarding_id, 2, 'Knowledge transfer', 'Document and transfer key responsibilities', 'manager', 7, true),
  (v_offboarding_id, 3, 'Revoke IT access', 'Disable accounts and revoke system access', 'it', 1, true),
  (v_offboarding_id, 4, 'Collect equipment', 'Return laptop, keys, access cards', 'hr', 1, true),
  (v_offboarding_id, 5, 'Final paycheck', 'Process final salary and benefits', 'hr', 3, true),
  (v_offboarding_id, 6, 'Update records', 'Update HR systems and org charts', 'hr', 3, true),
  (v_offboarding_id, 7, 'Archive documents', 'Archive employee files per retention policy', 'hr', 7, true);

  RAISE NOTICE 'Created 3 workflow templates for org %', p_org_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage (uncomment and replace with actual org_id):
-- SELECT seed_workflow_templates('your-org-id-here');
