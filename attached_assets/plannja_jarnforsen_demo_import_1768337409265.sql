
-- ============================
-- Production Leader OS - Demo Import (REF tables)
-- Org lookup by name: Plannja Järnforsen
-- Run in Supabase SQL editor
-- ============================

do $$
declare v_org_id uuid;
begin
  select id into v_org_id
  from public.organizations
  where name ilike 'Plannja Järnforsen'
  limit 1;

  if v_org_id is null then
    raise exception 'Organization not found: Plannja Järnforsen. Create it in organizations first.';
  end if;

  -- Create reference/master tables (safe, does not touch core tables)
  create table if not exists public.pl_departments (
    org_id uuid not null,
    department_code text not null,
    department_name text not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, department_code)
  );

  create table if not exists public.pl_lines (
    org_id uuid not null,
    line_code text not null,
    line_name text not null,
    department_code text not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, line_code)
  );

  create table if not exists public.pl_machines (
    org_id uuid not null,
    machine_code text not null,
    machine_name text not null,
    line_code text not null,
    machine_type text,
    is_critical boolean not null default false,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, machine_code)
  );

  create table if not exists public.pl_employees (
    org_id uuid not null,
    employee_code text not null,
    full_name text not null,
    department_code text,
    default_line_code text,
    employment_type text,
    weekly_capacity_hours numeric,
    manager_code text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, employee_code)
  );

  -- Shift templates + rotation
  create table if not exists public.pl_shift_templates (
    org_id uuid not null,
    shift_type text not null check (shift_type in ('Day','Evening','Night')),
    weekday int not null check (weekday between 1 and 7),
    start_time time not null,
    end_time time not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, shift_type, weekday)
  );

  create table if not exists public.pl_crews (
    org_id uuid not null,
    crew_code text not null,
    crew_name text not null,
    default_department_code text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, crew_code)
  );

  create table if not exists public.pl_crew_members (
    org_id uuid not null,
    crew_code text not null,
    employee_code text not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, crew_code, employee_code)
  );

  create table if not exists public.pl_crew_rotation_rules (
    org_id uuid not null,
    crew_code text not null,
    cycle_length_weeks int not null check (cycle_length_weeks between 1 and 8),
    week_in_cycle int not null,
    shift_type text not null check (shift_type in ('Day','Evening','Night')),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, crew_code, cycle_length_weeks, week_in_cycle)
  );

  -- Planning (daily)
  create table if not exists public.pl_attendance (
    org_id uuid not null,
    plan_date date not null,
    shift_type text not null check (shift_type in ('Day','Evening','Night')),
    employee_code text not null,
    status text not null check (status in ('present','absent','partial')),
    available_from time,
    available_to time,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, plan_date, shift_type, employee_code)
  );

  create table if not exists public.pl_machine_demand (
    org_id uuid not null,
    plan_date date not null,
    shift_type text not null check (shift_type in ('Day','Evening','Night')),
    machine_code text not null,
    required_hours numeric not null,
    priority int not null default 2 check (priority between 1 and 3),
    comment text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, plan_date, shift_type, machine_code)
  );

  create table if not exists public.pl_assignment_segments (
    org_id uuid not null,
    plan_date date not null,
    shift_type text not null check (shift_type in ('Day','Evening','Night')),
    machine_code text not null,
    employee_code text,
    start_time time not null,
    end_time time not null,
    role_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.pl_overtime_overrides (
    org_id uuid not null,
    plan_date date not null,
    shift_type text not null check (shift_type in ('Day','Evening','Night')),
    employee_code text not null,
    machine_code text,
    start_time time,
    end_time time,
    hours numeric,
    reason text,
    approved_by text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

end $$;


do $$
declare v_org_id uuid;
begin
  select id into v_org_id from public.organizations where name ilike 'Plannja Järnforsen' limit 1;
  if v_org_id is null then raise exception 'Organization not found: Plannja Järnforsen'; end if;

  insert into public.pl_departments (org_id, department_code, department_name, notes) values
    (v_org_id, 'TAK', 'TAK', NULL),
    (v_org_id, 'TAV', 'TAV', NULL),
    (v_org_id, 'UH', 'Underhåll', NULL),
    (v_org_id, 'LAGER', 'Lager', NULL),
    (v_org_id, 'TRANS', 'Transport', NULL),
    (v_org_id, 'SPEC', 'Special ', NULL)
  on conflict (org_id, department_code) do update set department_name=excluded.department_name, notes=excluded.notes;
  insert into public.pl_lines (org_id, line_code, line_name, department_code, notes) values
    (v_org_id, 'Regent', 'Regent', 'TAK', NULL),
    (v_org_id, 'Royal', 'Royak', 'TAK', NULL),
    (v_org_id, 'P20 75', 'L 12', 'TAK', NULL),
    (v_org_id, 'P20 305', 'L 12', 'TAK', NULL),
    (v_org_id, 'Sin 38', 'L 13', 'TAK', NULL),
    (v_org_id, 'Sin 53', 'L13', 'TAK', NULL),
    (v_org_id, 'Modern', 'L 14', 'TAK', NULL),
    (v_org_id, 'Pann', 'L 14', 'TAK', NULL),
    (v_org_id, 'P 39', 'L 14', 'TAK', NULL),
    (v_org_id, 'Bes 1', 'Beslag 1', 'TAK', NULL),
    (v_org_id, 'Bes 2', 'Beslag 2', 'TAK', NULL),
    (v_org_id, 'Bes 3', 'Beslag 3', 'TAK', NULL),
    (v_org_id, 'Slit 2', 'Slit 2', 'TAK', NULL),
    (v_org_id, 'Hasp 3', 'Haspel 3', 'TAK', NULL),
    (v_org_id, 'Klip 1', 'Klip 1', 'TAK', NULL),
    (v_org_id, 'Hubtex', 'Trcuk ', 'TAK', NULL),
    (v_org_id, 'L701', 'L 16', 'TAK', NULL),
    (v_org_id, 'L702', 'L 17', 'TAK', NULL),
    (v_org_id, 'L703', 'L 18', 'TAK', NULL),
    (v_org_id, 'P 15', 'L 15', 'TAK', NULL),
    (v_org_id, 'P 45', 'L 15', 'TAK', NULL),
    (v_org_id, 'CD 45', 'L 15', 'TAK', NULL),
    (v_org_id, 'Prof EMB', 'Emballering', 'TAK', NULL),
    (v_org_id, 204, 204, 'TAV', NULL),
    (v_org_id, 207, 207, 'TAV', NULL),
    (v_org_id, 211, 211, 'TAV', NULL),
    (v_org_id, 216, 216, 'TAV', NULL),
    (v_org_id, 499, 499, 'TAV', NULL),
    (v_org_id, 348, 348, 'TAV', NULL),
    (v_org_id, 349, 349, 'TAV', NULL),
    (v_org_id, 350, 350, 'TAV', NULL),
    (v_org_id, 357, 357, 'TAV', NULL),
    (v_org_id, 358, 358, 'TAV', NULL)
  on conflict (org_id, line_code) do update set line_name=excluded.line_name, department_code=excluded.department_code, notes=excluded.notes;
  insert into public.pl_machines (org_id, machine_code, machine_name, line_code, machine_type, is_critical, notes) values
    (v_org_id, 'Regent', 'Regent', 'Regent', 'Rollforming', 1, NULL),
    (v_org_id, 'Royal', 'Royal', 'Royal', 'Rollforming', 1, NULL),
    (v_org_id, 'P20 75', 'P20 75', 'P20 75', 'Rollforming', 1, NULL),
    (v_org_id, 'P20 305', 'P20 305', 'P20 305', 'Rollforming', 1, NULL),
    (v_org_id, 'Sin 38', 'Sin 38', 'Sin 38', 'Rollforming', 1, NULL),
    (v_org_id, 'Sin 53', 'Sin 53', 'Sin 53', 'Rollforming', 1, NULL),
    (v_org_id, 'Modern', 'Modern', 'Modern', 'Rollforming', 1, NULL),
    (v_org_id, 'Pann', 'Pann', 'Pann', 'Rollforming', 1, NULL),
    (v_org_id, 'P 37', 'P 38', 'P 39', 'Rollforming', 1, NULL),
    (v_org_id, 'Bes 1', 'Bes 1', 'Bes 1', 'Rollforming', 1, NULL),
    (v_org_id, 'Bes 2', 'Bes 2', 'Bes 2', 'Rollforming', 1, NULL),
    (v_org_id, 'Bes 3', 'Bes 3', 'Bes 3', 'Rollforming', 1, NULL),
    (v_org_id, 'Slit 0', 'Slit 1', 'Slit 2', 'Slitting', 1, NULL),
    (v_org_id, 'Hasp 1', 'Hasp 2', 'Hasp 3', 'Rolling', 1, NULL),
    (v_org_id, 'Klip 1', 'Klip 0', 'Klip 1', 'Cut to length ', 1, NULL),
    (v_org_id, 'Hubtex', 'Hubtex', 'Hubtex', 'Forklift', 1, NULL),
    (v_org_id, 'L701', 'L701', 'L701', 'Ränna', 1, NULL),
    (v_org_id, 'L702', 'L702', 'L702', 'Ränna', 1, NULL),
    (v_org_id, 'L703', 'L703', 'L703', 'Rör', 1, NULL),
    (v_org_id, 'P 15', 'P 15', 'P 15', 'Rollforming', 1, NULL),
    (v_org_id, 'P 45', 'P 45', 'P 45', 'Rollforming', 1, NULL),
    (v_org_id, 'CD 43', 'CD 44', 'CD 45', 'Rollforming', 1, NULL),
    (v_org_id, 'Prof EMB', 'Prof EMB', 'Prof EMB', 'Packing', 1, NULL),
    (v_org_id, 204, 204, 204, 'Krok', 1, NULL),
    (v_org_id, 207, 207, 207, 'Krok', 1, NULL),
    (v_org_id, 211, 211, 211, 'Paintshop', 1, NULL),
    (v_org_id, 216, 216, 216, 'Krok', 1, NULL),
    (v_org_id, 499, 499, 499, 'Krok', 1, NULL),
    (v_org_id, 348, 348, 348, 'Press', 1, NULL),
    (v_org_id, 349, 349, 349, 'Press', 1, NULL),
    (v_org_id, 350, 350, 350, 'Press', 1, NULL)
  on conflict (org_id, machine_code) do update set machine_name=excluded.machine_name, line_code=excluded.line_code, machine_type=excluded.machine_type, is_critical=excluded.is_critical, notes=excluded.notes;
  insert into public.pl_employees (org_id, employee_code, full_name, department_code, default_line_code, employment_type, weekly_capacity_hours, manager_code, notes) values
    (v_org_id, 'M001', 'Marie', 'TAK', NULL, 'Manager', 40, NULL, NULL),
    (v_org_id, 'T001', 'Aneta', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T002', 'Anna', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T003', 'Caroline', 'TAK', NULL, 'Team lead', 40, NULL, NULL),
    (v_org_id, 'T004', 'Christin K', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T005', 'Eddie', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T006', 'Enes', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T007', 'Hussam', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T008', 'Håkan', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T009', 'Jens', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T010', 'Jörg', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T011', 'Khaled', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T012', 'Kim L', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T013', 'Kim R', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T014', 'Kristin B', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T015', 'Lennart', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T016', 'Mikael', 'TAK', NULL, 'Team lead', 40, NULL, NULL),
    (v_org_id, 'T017', 'Mohammad', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T018', 'Moshin', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T019', 'Ola F', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T020', 'Percy', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T021', 'Philip', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T022', 'Rasmus', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T023', 'Ricky', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T024', 'Robert', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T025', 'Ted', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T026', 'Thomas S', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T027', 'Tomas B', 'TAK', NULL, 'Operator', 40, NULL, NULL),
    (v_org_id, 'T028', 'Tony', 'TAK', NULL, 'Team lead', 40, NULL, NULL),
    (v_org_id, 'T029', 'Vangelis', 'TAK', NULL, 'Operator', 40, NULL, NULL)
  on conflict (org_id, employee_code) do update set full_name=excluded.full_name, department_code=excluded.department_code, default_line_code=excluded.default_line_code, employment_type=excluded.employment_type, weekly_capacity_hours=excluded.weekly_capacity_hours, manager_code=excluded.manager_code, notes=excluded.notes;
  insert into public.pl_shift_templates (org_id, shift_type, weekday, start_time, end_time, notes) values
    (v_org_id, 'Day', 1, '07:00', '16:00', 'Mon'),
    (v_org_id, 'Day', 2, '07:00', '16:00', 'Tue'),
    (v_org_id, 'Day', 3, '07:00', '16:00', 'Wed'),
    (v_org_id, 'Day', 4, '07:00', '16:00', 'Thu'),
    (v_org_id, 'Day', 5, '07:00', '16:00', 'Fri'),
    (v_org_id, 'Evening', 1, '14:00', '23:00', 'Mon'),
    (v_org_id, 'Evening', 2, '14:00', '23:00', 'Tue'),
    (v_org_id, 'Evening', 3, '14:00', '23:00', 'Wed'),
    (v_org_id, 'Evening', 4, '14:00', '23:00', 'Thu'),
    (v_org_id, 'Night', 1, '23:00', '07:00', 'Optional permanent night')
  on conflict (org_id, shift_type, weekday) do update set start_time=excluded.start_time, end_time=excluded.end_time, notes=excluded.notes;
  insert into public.pl_crews (org_id, crew_code, crew_name, default_department_code, notes) values
    (v_org_id, 'A', 'Crew A', 'PRESS', 'Rotates Day/Evening'),
    (v_org_id, 'B', 'Crew B', 'ASSY', 'Rotates Day/Evening'),
    (v_org_id, 'N', 'Night Crew', 'PRESS', 'Permanent Night (optional)')
  on conflict (org_id, crew_code) do update set crew_name=excluded.crew_name, default_department_code=excluded.default_department_code, notes=excluded.notes;
  insert into public.pl_crew_members (org_id, crew_code, employee_code, notes) values
    (v_org_id, 'A', 'E001', NULL),
    (v_org_id, 'A', 'E002', NULL),
    (v_org_id, 'B', 'E003', NULL),
    (v_org_id, 'B', 'E004', NULL)
  on conflict (org_id, crew_code, employee_code) do update set notes=excluded.notes;
  insert into public.pl_crew_rotation_rules (org_id, crew_code, cycle_length_weeks, week_in_cycle, shift_type, notes) values
    (v_org_id, 'A', 2, 1, 'Day', NULL),
    (v_org_id, 'A', 2, 2, 'Evening', NULL),
    (v_org_id, 'B', 2, 1, 'Evening', NULL),
    (v_org_id, 'B', 2, 2, 'Day', NULL),
    (v_org_id, 'N', 1, 1, 'Night', 'Permanent night')
  on conflict (org_id, crew_code, cycle_length_weeks, week_in_cycle) do update set shift_type=excluded.shift_type, notes=excluded.notes;
  insert into public.pl_attendance (org_id, plan_date, shift_type, employee_code, status, available_from, available_to, note) values
    (v_org_id, '2026-01-12', 'Day', 'E001', 'present', '07:00', '16:00', NULL),
    (v_org_id, '2026-01-12', 'Day', 'E002', 'present', '07:00', '16:00', NULL),
    (v_org_id, '2026-01-12', 'Day', 'E003', 'absent', NULL, NULL, 'Sick leave'),
    (v_org_id, '2026-01-12', 'Day', 'E004', 'partial', '10:00', '16:00', 'Arrives late')
  on conflict (org_id, plan_date, shift_type, employee_code) do update set status=excluded.status, available_from=excluded.available_from, available_to=excluded.available_to, note=excluded.note;
  insert into public.pl_machine_demand (org_id, plan_date, shift_type, machine_code, required_hours, priority, comment) values
    (v_org_id, '2026-01-12', 'Day', 'PR-A', 8, 3, 'Critical press output'),
    (v_org_id, '2026-01-12', 'Day', 'PR-B', 8, 2, NULL),
    (v_org_id, '2026-01-12', 'Day', 'AS-1', 8, 3, NULL),
    (v_org_id, '2026-01-12', 'Day', 'AS-2', 8, 2, NULL),
    (v_org_id, '2026-01-12', 'Day', 'QC-1', 8, 2, NULL)
  on conflict (org_id, plan_date, shift_type, machine_code) do update set required_hours=excluded.required_hours, priority=excluded.priority, comment=excluded.comment;
  -- Append-only segments (clear existing for same org/date/shift if you want)
  delete from public.pl_assignment_segments where org_id=v_org_id;
  insert into public.pl_assignment_segments (org_id, plan_date, shift_type, machine_code, employee_code, start_time, end_time, role_note) values
    (v_org_id, '2026-01-12', 'Day', 'PR-A', 'E001', '07:00', '11:00', NULL),
    (v_org_id, '2026-01-12', 'Day', 'QC-1', 'E001', '11:00', '13:00', 'Cover QC lunch'),
    (v_org_id, '2026-01-12', 'Day', 'PR-A', 'E001', '13:00', '16:00', NULL);
  delete from public.pl_overtime_overrides where org_id=v_org_id;
  insert into public.pl_overtime_overrides (org_id, plan_date, shift_type, employee_code, machine_code, start_time, end_time, hours, reason, approved_by, notes) values
    (v_org_id, '2026-01-13', 'Day', 'E002', 'PR-B', '16:00', '18:00', 2, 'Overtime to cover backlog', NULL, NULL),
    (v_org_id, '2026-01-13', 'Evening', 'E001', 'PR-A', '23:00', '01:00', 2, 'Overtime after shift', NULL, NULL);
end $$;
