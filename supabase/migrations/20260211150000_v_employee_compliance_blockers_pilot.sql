-- v_employee_compliance_blockers_pilot: expired-only blockers for pilot mode.
-- Keeps v_employee_compliance_status unchanged; this view filters to EXPIRED.
CREATE OR REPLACE VIEW public.v_employee_compliance_blockers_pilot
WITH (security_invoker = true)
AS
SELECT *
FROM public.v_employee_compliance_status
WHERE status = 'EXPIRED';

COMMENT ON VIEW public.v_employee_compliance_blockers_pilot IS
  'Pilot compliance blockers: EXPIRED items only (MISSING is warning).';

GRANT SELECT ON public.v_employee_compliance_blockers_pilot TO authenticated;
-- v_employee_compliance_blockers_pilot: expired-only blockers for pilot mode.
-- Keeps v_employee_compliance_status unchanged; this view filters to EXPIRED.
CREATE OR REPLACE VIEW public.v_employee_compliance_blockers_pilot
WITH (security_invoker = true)
AS
SELECT *
FROM public.v_employee_compliance_status
WHERE status = 'EXPIRED';

COMMENT ON VIEW public.v_employee_compliance_blockers_pilot IS
  'Pilot compliance blockers: EXPIRED items only (MISSING is warning).';

GRANT SELECT ON public.v_employee_compliance_blockers_pilot TO authenticated;
