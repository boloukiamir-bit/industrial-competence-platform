-- ============================
-- Plannja Järnforsen Demo Data
-- Run AFTER 007_production_leader_schema.sql
-- Run in Supabase SQL Editor
-- ============================

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Lookup organization by name
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE name ILIKE 'Plannja Järnforsen'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found: Plannja Järnforsen. Create it in organizations first.';
  END IF;

  -- ========== DEPARTMENTS ==========
  INSERT INTO public.pl_departments (org_id, department_code, department_name, notes) VALUES
    (v_org_id, 'TAK', 'TAK', NULL),
    (v_org_id, 'TAV', 'TAV', NULL),
    (v_org_id, 'UH', 'Underhåll', NULL),
    (v_org_id, 'LAGER', 'Lager', NULL),
    (v_org_id, 'TRANS', 'Transport', NULL),
    (v_org_id, 'SPEC', 'Special', NULL)
  ON CONFLICT (org_id, department_code) DO UPDATE SET 
    department_name = EXCLUDED.department_name, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== LINES ==========
  INSERT INTO public.pl_lines (org_id, line_code, line_name, department_code, notes) VALUES
    (v_org_id, 'Regent', 'Regent', 'TAK', NULL),
    (v_org_id, 'Royal', 'Royal', 'TAK', NULL),
    (v_org_id, 'P20-75', 'L 12', 'TAK', NULL),
    (v_org_id, 'P20-305', 'L 12', 'TAK', NULL),
    (v_org_id, 'Sin-38', 'L 13', 'TAK', NULL),
    (v_org_id, 'Sin-53', 'L13', 'TAK', NULL),
    (v_org_id, 'Modern', 'L 14', 'TAK', NULL),
    (v_org_id, 'Pann', 'L 14', 'TAK', NULL),
    (v_org_id, 'P-39', 'L 14', 'TAK', NULL),
    (v_org_id, 'Bes-1', 'Beslag 1', 'TAK', NULL),
    (v_org_id, 'Bes-2', 'Beslag 2', 'TAK', NULL),
    (v_org_id, 'Bes-3', 'Beslag 3', 'TAK', NULL),
    (v_org_id, 'Slit-2', 'Slit 2', 'TAK', NULL),
    (v_org_id, 'Hasp-3', 'Haspel 3', 'TAK', NULL),
    (v_org_id, 'Klip-1', 'Klip 1', 'TAK', NULL),
    (v_org_id, 'Hubtex', 'Truck', 'TAK', NULL),
    (v_org_id, 'L701', 'L 16', 'TAK', NULL),
    (v_org_id, 'L702', 'L 17', 'TAK', NULL),
    (v_org_id, 'L703', 'L 18', 'TAK', NULL),
    (v_org_id, 'P-15', 'L 15', 'TAK', NULL),
    (v_org_id, 'P-45', 'L 15', 'TAK', NULL),
    (v_org_id, 'CD-45', 'L 15', 'TAK', NULL),
    (v_org_id, 'Prof-EMB', 'Emballering', 'TAK', NULL),
    (v_org_id, 'L204', '204', 'TAV', NULL),
    (v_org_id, 'L207', '207', 'TAV', NULL),
    (v_org_id, 'L211', '211', 'TAV', NULL),
    (v_org_id, 'L216', '216', 'TAV', NULL),
    (v_org_id, 'L499', '499', 'TAV', NULL),
    (v_org_id, 'L348', '348', 'TAV', NULL),
    (v_org_id, 'L349', '349', 'TAV', NULL),
    (v_org_id, 'L350', '350', 'TAV', NULL),
    (v_org_id, 'L357', '357', 'TAV', NULL),
    (v_org_id, 'L358', '358', 'TAV', NULL)
  ON CONFLICT (org_id, line_code) DO UPDATE SET 
    line_name = EXCLUDED.line_name, 
    department_code = EXCLUDED.department_code, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== MACHINES ==========
  INSERT INTO public.pl_machines (org_id, machine_code, machine_name, line_code, machine_type, is_critical, notes) VALUES
    (v_org_id, 'Regent', 'Regent', 'Regent', 'Rollforming', true, NULL),
    (v_org_id, 'Royal', 'Royal', 'Royal', 'Rollforming', true, NULL),
    (v_org_id, 'P20-75', 'P20 75', 'P20-75', 'Rollforming', true, NULL),
    (v_org_id, 'P20-305', 'P20 305', 'P20-305', 'Rollforming', true, NULL),
    (v_org_id, 'Sin-38', 'Sin 38', 'Sin-38', 'Rollforming', true, NULL),
    (v_org_id, 'Sin-53', 'Sin 53', 'Sin-53', 'Rollforming', true, NULL),
    (v_org_id, 'Modern', 'Modern', 'Modern', 'Rollforming', true, NULL),
    (v_org_id, 'Pann', 'Pann', 'Pann', 'Rollforming', true, NULL),
    (v_org_id, 'P-39', 'P 39', 'P-39', 'Rollforming', true, NULL),
    (v_org_id, 'Bes-1', 'Bes 1', 'Bes-1', 'Rollforming', true, NULL),
    (v_org_id, 'Bes-2', 'Bes 2', 'Bes-2', 'Rollforming', true, NULL),
    (v_org_id, 'Bes-3', 'Bes 3', 'Bes-3', 'Rollforming', true, NULL),
    (v_org_id, 'Slit-2', 'Slit 2', 'Slit-2', 'Slitting', true, NULL),
    (v_org_id, 'Hasp-3', 'Hasp 3', 'Hasp-3', 'Rolling', true, NULL),
    (v_org_id, 'Klip-1', 'Klip 1', 'Klip-1', 'Cut to length', true, NULL),
    (v_org_id, 'Hubtex', 'Hubtex', 'Hubtex', 'Forklift', true, NULL),
    (v_org_id, 'L701', 'L701', 'L701', 'Ränna', true, NULL),
    (v_org_id, 'L702', 'L702', 'L702', 'Ränna', true, NULL),
    (v_org_id, 'L703', 'L703', 'L703', 'Rör', true, NULL),
    (v_org_id, 'P-15', 'P 15', 'P-15', 'Rollforming', true, NULL),
    (v_org_id, 'P-45', 'P 45', 'P-45', 'Rollforming', true, NULL),
    (v_org_id, 'CD-45', 'CD 45', 'CD-45', 'Rollforming', true, NULL),
    (v_org_id, 'Prof-EMB', 'Prof EMB', 'Prof-EMB', 'Packing', true, NULL),
    (v_org_id, 'M204', '204', 'L204', 'Krok', true, NULL),
    (v_org_id, 'M207', '207', 'L207', 'Krok', true, NULL),
    (v_org_id, 'M211', '211', 'L211', 'Paintshop', true, NULL),
    (v_org_id, 'M216', '216', 'L216', 'Krok', true, NULL),
    (v_org_id, 'M499', '499', 'L499', 'Krok', true, NULL),
    (v_org_id, 'M348', '348', 'L348', 'Press', true, NULL),
    (v_org_id, 'M349', '349', 'L349', 'Press', true, NULL),
    (v_org_id, 'M350', '350', 'L350', 'Press', true, NULL)
  ON CONFLICT (org_id, machine_code) DO UPDATE SET 
    machine_name = EXCLUDED.machine_name, 
    line_code = EXCLUDED.line_code, 
    machine_type = EXCLUDED.machine_type, 
    is_critical = EXCLUDED.is_critical, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== EMPLOYEES ==========
  INSERT INTO public.pl_employees (org_id, employee_code, full_name, department_code, default_line_code, employment_type, weekly_capacity_hours, manager_code, notes) VALUES
    (v_org_id, 'M001', 'Marie', 'TAK', NULL, 'Manager', 40, NULL, NULL),
    (v_org_id, 'T001', 'Aneta', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T002', 'Anna', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T003', 'Caroline', 'TAK', NULL, 'Team lead', 40, 'M001', NULL),
    (v_org_id, 'T004', 'Christin K', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T005', 'Eddie', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T006', 'Enes', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T007', 'Hussam', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T008', 'Håkan', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T009', 'Jens', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T010', 'Jörg', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T011', 'Khaled', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T012', 'Kim L', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T013', 'Kim R', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T014', 'Kristin B', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T015', 'Lennart', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T016', 'Mikael', 'TAK', NULL, 'Team lead', 40, 'M001', NULL),
    (v_org_id, 'T017', 'Mohammad', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T018', 'Moshin', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T019', 'Ola F', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T020', 'Percy', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T021', 'Philip', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T022', 'Rasmus', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T023', 'Ricky', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T024', 'Robert', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T025', 'Ted', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T026', 'Thomas S', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T027', 'Tomas B', 'TAK', NULL, 'Operator', 40, 'M001', NULL),
    (v_org_id, 'T028', 'Tony', 'TAK', NULL, 'Team lead', 40, 'M001', NULL),
    (v_org_id, 'T029', 'Vangelis', 'TAK', NULL, 'Operator', 40, 'M001', NULL)
  ON CONFLICT (org_id, employee_code) DO UPDATE SET 
    full_name = EXCLUDED.full_name, 
    department_code = EXCLUDED.department_code, 
    default_line_code = EXCLUDED.default_line_code, 
    employment_type = EXCLUDED.employment_type, 
    weekly_capacity_hours = EXCLUDED.weekly_capacity_hours, 
    manager_code = EXCLUDED.manager_code, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== SHIFT TEMPLATES ==========
  INSERT INTO public.pl_shift_templates (org_id, shift_type, weekday, start_time, end_time, notes) VALUES
    (v_org_id, 'Day', 1, '07:00', '16:00', 'Monday'),
    (v_org_id, 'Day', 2, '07:00', '16:00', 'Tuesday'),
    (v_org_id, 'Day', 3, '07:00', '16:00', 'Wednesday'),
    (v_org_id, 'Day', 4, '07:00', '16:00', 'Thursday'),
    (v_org_id, 'Day', 5, '07:00', '16:00', 'Friday'),
    (v_org_id, 'Evening', 1, '14:00', '23:00', 'Monday'),
    (v_org_id, 'Evening', 2, '14:00', '23:00', 'Tuesday'),
    (v_org_id, 'Evening', 3, '14:00', '23:00', 'Wednesday'),
    (v_org_id, 'Evening', 4, '14:00', '23:00', 'Thursday'),
    (v_org_id, 'Night', 1, '23:00', '07:00', 'Optional permanent night')
  ON CONFLICT (org_id, shift_type, weekday) DO UPDATE SET 
    start_time = EXCLUDED.start_time, 
    end_time = EXCLUDED.end_time, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== CREWS ==========
  INSERT INTO public.pl_crews (org_id, crew_code, crew_name, default_department_code, notes) VALUES
    (v_org_id, 'A', 'Crew A', 'TAK', 'Rotates Day/Evening'),
    (v_org_id, 'B', 'Crew B', 'TAK', 'Rotates Day/Evening'),
    (v_org_id, 'N', 'Night Crew', 'TAK', 'Permanent Night (optional)')
  ON CONFLICT (org_id, crew_code) DO UPDATE SET 
    crew_name = EXCLUDED.crew_name, 
    default_department_code = EXCLUDED.default_department_code, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== CREW MEMBERS ==========
  INSERT INTO public.pl_crew_members (org_id, crew_code, employee_code, notes) VALUES
    (v_org_id, 'A', 'T001', NULL),
    (v_org_id, 'A', 'T002', NULL),
    (v_org_id, 'A', 'T003', NULL),
    (v_org_id, 'A', 'T004', NULL),
    (v_org_id, 'A', 'T005', NULL),
    (v_org_id, 'B', 'T006', NULL),
    (v_org_id, 'B', 'T007', NULL),
    (v_org_id, 'B', 'T008', NULL),
    (v_org_id, 'B', 'T009', NULL),
    (v_org_id, 'B', 'T010', NULL)
  ON CONFLICT (org_id, crew_code, employee_code) DO UPDATE SET 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== CREW ROTATION RULES ==========
  INSERT INTO public.pl_crew_rotation_rules (org_id, crew_code, cycle_length_weeks, week_in_cycle, shift_type, notes) VALUES
    (v_org_id, 'A', 2, 1, 'Day', NULL),
    (v_org_id, 'A', 2, 2, 'Evening', NULL),
    (v_org_id, 'B', 2, 1, 'Evening', NULL),
    (v_org_id, 'B', 2, 2, 'Day', NULL),
    (v_org_id, 'N', 1, 1, 'Night', 'Permanent night')
  ON CONFLICT (org_id, crew_code, cycle_length_weeks, week_in_cycle) DO UPDATE SET 
    shift_type = EXCLUDED.shift_type, 
    notes = EXCLUDED.notes,
    updated_at = now();

  -- ========== SAMPLE ATTENDANCE (Today) ==========
  INSERT INTO public.pl_attendance (org_id, plan_date, shift_type, employee_code, status, available_from, available_to, note) VALUES
    (v_org_id, CURRENT_DATE, 'Day', 'T001', 'present', '07:00', '16:00', NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'T002', 'present', '07:00', '16:00', NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'T003', 'absent', NULL, NULL, 'Sick leave'),
    (v_org_id, CURRENT_DATE, 'Day', 'T004', 'partial', '10:00', '16:00', 'Arrives late'),
    (v_org_id, CURRENT_DATE, 'Day', 'T005', 'present', '07:00', '16:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'T006', 'present', '14:00', '23:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'T007', 'present', '14:00', '23:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'T008', 'absent', NULL, NULL, 'VAB'),
    (v_org_id, CURRENT_DATE, 'Evening', 'T009', 'present', '14:00', '23:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'T010', 'present', '14:00', '23:00', NULL)
  ON CONFLICT (org_id, plan_date, shift_type, employee_code) DO UPDATE SET 
    status = EXCLUDED.status, 
    available_from = EXCLUDED.available_from, 
    available_to = EXCLUDED.available_to, 
    note = EXCLUDED.note,
    updated_at = now();

  -- ========== SAMPLE MACHINE DEMAND ==========
  INSERT INTO public.pl_machine_demand (org_id, plan_date, shift_type, machine_code, required_hours, priority, comment) VALUES
    (v_org_id, CURRENT_DATE, 'Day', 'Regent', 8, 3, 'Critical press output'),
    (v_org_id, CURRENT_DATE, 'Day', 'Royal', 8, 2, NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'P20-75', 8, 3, NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'Modern', 8, 2, NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'L701', 8, 2, NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'Regent', 8, 3, 'Evening run'),
    (v_org_id, CURRENT_DATE, 'Evening', 'Royal', 8, 2, NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'P20-75', 8, 2, NULL)
  ON CONFLICT (org_id, plan_date, shift_type, machine_code) DO UPDATE SET 
    required_hours = EXCLUDED.required_hours, 
    priority = EXCLUDED.priority, 
    comment = EXCLUDED.comment,
    updated_at = now();

  -- ========== SAMPLE ASSIGNMENTS ==========
  DELETE FROM public.pl_assignment_segments WHERE org_id = v_org_id AND plan_date = CURRENT_DATE;
  INSERT INTO public.pl_assignment_segments (org_id, plan_date, shift_type, machine_code, employee_code, start_time, end_time, role_note) VALUES
    (v_org_id, CURRENT_DATE, 'Day', 'Regent', 'T001', '07:00', '11:00', NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'L701', 'T001', '11:00', '13:00', 'Cover lunch'),
    (v_org_id, CURRENT_DATE, 'Day', 'Regent', 'T001', '13:00', '16:00', NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'Royal', 'T002', '07:00', '16:00', NULL),
    (v_org_id, CURRENT_DATE, 'Day', 'P20-75', 'T005', '07:00', '16:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'Regent', 'T006', '14:00', '23:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'Royal', 'T007', '14:00', '23:00', NULL),
    (v_org_id, CURRENT_DATE, 'Evening', 'P20-75', 'T009', '14:00', '23:00', NULL);

  -- ========== SAMPLE OVERTIME ==========
  DELETE FROM public.pl_overtime_overrides WHERE org_id = v_org_id;
  INSERT INTO public.pl_overtime_overrides (org_id, plan_date, shift_type, employee_code, machine_code, start_time, end_time, hours, reason, approved_by, notes) VALUES
    (v_org_id, CURRENT_DATE + 1, 'Day', 'T002', 'Royal', '16:00', '18:00', 2, 'Overtime to cover backlog', 'M001', NULL),
    (v_org_id, CURRENT_DATE + 1, 'Evening', 'T001', 'Regent', '23:00', '01:00', 2, 'Overtime after shift', 'M001', NULL);

  RAISE NOTICE 'Demo data imported successfully for org_id: %', v_org_id;
END $$;
