-- Roster employee IDs for compliance matrix (org_id + shift_date + shift_code).
CREATE OR REPLACE FUNCTION public.get_roster_employee_ids(
  p_org_id uuid,
  p_shift_date date,
  p_shift_code text
)
RETURNS TABLE(employee_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT sa.employee_id
  FROM public.shift_assignments sa
  JOIN public.shifts sh ON sh.id = sa.shift_id AND sh.org_id = sa.org_id
  WHERE sa.org_id = p_org_id
    AND sa.employee_id IS NOT NULL
    AND sh.shift_date = p_shift_date
    AND sh.shift_code = p_shift_code;
$$;

COMMENT ON FUNCTION public.get_roster_employee_ids(uuid, date, text) IS
  'Roster-scoped employee IDs from shift_assignments for (org_id, shift_date, shift_code).';

GRANT EXECUTE ON FUNCTION public.get_roster_employee_ids(uuid, date, text) TO authenticated;
