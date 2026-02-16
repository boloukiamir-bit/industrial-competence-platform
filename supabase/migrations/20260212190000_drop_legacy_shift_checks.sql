alter table public.shifts
drop constraint if exists shifts_shift_type_check;

alter table public.shifts
drop constraint if exists shifts_line_allowed_values;
