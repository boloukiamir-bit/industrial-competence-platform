-- RPC for cockpit compliance-actions-summary: top assignees by open count (SQL-level grouping).
-- Returns assigned_to_user_id (alias of owner_user_id) and open_count; same site filter as other summary queries.

CREATE OR REPLACE FUNCTION public.get_compliance_actions_top_assignees(
  p_org_id uuid,
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE(assigned_to_user_id uuid, open_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.owner_user_id AS assigned_to_user_id,
    count(*)::bigint AS open_count
  FROM public.compliance_actions a
  WHERE a.org_id = p_org_id
    AND a.status IN ('OPEN', 'IN_PROGRESS')
    AND (p_site_id IS NULL OR a.site_id IS NULL OR a.site_id = p_site_id)
  GROUP BY a.owner_user_id
  ORDER BY open_count DESC
  LIMIT 3;
$$;

COMMENT ON FUNCTION public.get_compliance_actions_top_assignees(uuid, uuid) IS
  'Cockpit summary: top 3 assignees by open action count; returns assigned_to_user_id (owner_user_id), open_count.';
