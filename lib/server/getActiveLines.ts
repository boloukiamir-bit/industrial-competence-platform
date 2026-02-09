/**
 * Canonical source for "lines" in the app: public.stations.
 * Use this everywhere instead of employees.line, pl_lines, or v_* views.
 *
 * Query: SELECT DISTINCT line FROM public.stations
 *        WHERE org_id = $1 AND is_active = true AND line IS NOT NULL
 *        ORDER BY line
 */
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getActiveLines(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("stations")
    .select("line")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .not("line", "is", null)
    .order("line");

  if (error) {
    throw new Error(`getActiveLines failed: ${error.message}`);
  }

  const distinct = [...new Set((data ?? []).map((r: { line?: string | null }) => r.line).filter((v): v is string => Boolean(v)))];
  return distinct.sort();
}
