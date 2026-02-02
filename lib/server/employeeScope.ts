/**
 * Single source of truth for employee list/count scope (org + site).
 * Used by GET /api/employees and GET /api/org/units so counts match.
 *
 * Rules:
 * - org_id = orgId
 * - is_active = true
 * - If activeSiteId is set: include employees where site_id = activeSiteId OR site_id IS NULL
 * - If activeSiteId is null: do not filter by site_id
 */
export type EmployeeScope = { orgId: string; activeSiteId: string | null };

export function buildEmployeeScope(params: {
  orgId: string;
  activeSiteId: string | null;
}): EmployeeScope {
  return {
    orgId: params.orgId,
    activeSiteId: params.activeSiteId ?? null,
  };
}

/**
 * Returns params for raw SQL: WHERE org_id = $1 AND is_active = true AND ($2::uuid IS NULL OR site_id = $2 OR site_id IS NULL).
 * Params are [orgId, activeSiteId] (when activeSiteId is null, the AND clause is effectively true).
 */
export function getEmployeeScopeSqlParams(scope: EmployeeScope): [string, string | null] {
  return [scope.orgId, scope.activeSiteId];
}

/** SQL fragment for site filter: use with params from getEmployeeScopeSqlParams. */
export const EMPLOYEE_SCOPE_SITE_FRAGMENT =
  "($2::uuid IS NULL OR site_id = $2 OR site_id IS NULL)";
