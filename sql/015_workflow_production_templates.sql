-- Production Workflow Templates for Spaljisten
-- 4 templates as specified: Shift Handover, Daily SQCDP, Competence Action, Incident

CREATE OR REPLACE FUNCTION seed_production_workflow_templates(p_org_id UUID)
RETURNS void AS $$
DECLARE
  v_template_id UUID;
BEGIN
  -- Delete existing templates for this org (clean slate)
  DELETE FROM wf_templates WHERE org_id = p_org_id;

  -- TEMPLATE 1: Skiftöverlämning – Standard (Logg + Risker)
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (
    p_org_id,
    'Skiftöverlämning – Standard (Logg + Risker)',
    'Standard shift handover checklist with production status, risks, and sign-off. Requires shift_date, shift_type, area_code.',
    'Production',
    true
  ) RETURNING id INTO v_template_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, owner_role, default_due_days, required) VALUES
    (v_template_id, 1, 'Produktionsstatus (SQDCP snapshot)', 'Supervisor', 0, true),
    (v_template_id, 2, 'Stopp & avvikelser (Top 3)', 'Supervisor', 0, true),
    (v_template_id, 3, 'Risker nästa skift (Top 5)', 'Supervisor', 0, true),
    (v_template_id, 4, 'Åtgärdslista nästa skift (Top 5)', 'Supervisor', 0, true),
    (v_template_id, 5, 'Säkerhetsnotis (incident/LOTO/riskzon)', 'Supervisor', 0, true),
    (v_template_id, 6, 'Sign-off (Avgående + Tillträdande)', 'Supervisor', 0, true);

  -- TEMPLATE 2: Daglig Produktionsstyrning – SQCDP Tavla (15 min)
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (
    p_org_id,
    'Daglig Produktionsstyrning – SQCDP Tavla (15 min)',
    'Daily 15-minute SQCDP board meeting. Requires shift_date, area_code.',
    'Production',
    true
  ) RETURNING id INTO v_template_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, owner_role, default_due_days, required) VALUES
    (v_template_id, 1, 'Safety (S)', 'Supervisor', 0, true),
    (v_template_id, 2, 'Quality (Q)', 'Quality', 0, true),
    (v_template_id, 3, 'Delivery (D)', 'Supervisor', 0, true),
    (v_template_id, 4, 'People (P)', 'Supervisor', 0, true),
    (v_template_id, 5, 'Action List (max 5 actions)', 'Supervisor', 0, true),
    (v_template_id, 6, 'Eskalering (vid behov)', 'Supervisor', 0, false);

  -- TEMPLATE 3: Kompetensåtgärd – 2 personer per kritisk station (Cross-training)
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (
    p_org_id,
    'Kompetensåtgärd – 2 personer per kritisk station',
    'Cross-training action plan to ensure 2+ people per critical station. Optional employee_id, requires area_code.',
    'Competence',
    true
  ) RETURNING id INTO v_template_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, owner_role, default_due_days, required) VALUES
    (v_template_id, 1, 'Välj kritisk station (Top risk)', 'Supervisor', 0, true),
    (v_template_id, 2, 'Identifiera trainees (2 kandidater)', 'Supervisor', 2, true),
    (v_template_id, 3, 'Skapa träningsplan + mentor', 'Supervisor', 7, true),
    (v_template_id, 4, 'Schemalägg träning i produktion', 'Supervisor', 7, true),
    (v_template_id, 5, 'Verifiering/Bedömning (nivå)', 'Supervisor', 14, true),
    (v_template_id, 6, 'Uppdatera skill rating i systemet', 'HR', 14, true),
    (v_template_id, 7, 'Close: coverage >=2 (nivå >=3)', 'Supervisor', 14, true);

  -- TEMPLATE 4: Incident/Near-miss – Åtgärd & Uppföljning
  INSERT INTO wf_templates (org_id, name, description, category, is_active)
  VALUES (
    p_org_id,
    'Incident/Near-miss – Åtgärd & Uppföljning',
    'Incident response and follow-up workflow. Requires employee_id (reporter/involved), area_code.',
    'Safety',
    true
  ) RETURNING id INTO v_template_id;

  INSERT INTO wf_template_steps (template_id, step_no, title, owner_role, default_due_days, required) VALUES
    (v_template_id, 1, 'Registrera händelse (kort beskrivning)', 'Supervisor', 0, true),
    (v_template_id, 2, 'Säkerställ omedelbar åtgärd (containment)', 'Supervisor', 0, true),
    (v_template_id, 3, 'Rotorsak (5 Why / Fishbone)', 'Supervisor', 3, true),
    (v_template_id, 4, 'Korrigerande åtgärder (CAPA)', 'Supervisor', 7, true),
    (v_template_id, 5, 'Verifiera effekt', 'Quality', 14, true),
    (v_template_id, 6, 'Stäng ärendet + kommunicera lärdom', 'Supervisor', 14, true);

  RAISE NOTICE 'Seeded 4 production workflow templates for org %', p_org_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-seed for Spaljisten org
SELECT seed_production_workflow_templates('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
