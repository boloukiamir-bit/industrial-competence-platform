/**
 * Shared base query for employees: always scopes by org_id and is_active=true.
 * Use for any list/suggest/read that should exclude deactivated employees.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function employeesBaseQuery(
  client: SupabaseClient,
  orgId: string,
  select = "*"
) {
  return client
    .from("employees")
    .select(select)
    .eq("org_id", orgId)
    .eq("is_active", true);
}
