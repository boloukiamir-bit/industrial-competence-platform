/**
 * Deterministic roster employee IDs for a shift. Reused by cockpit summary and requirements-summary-v2.
 * Returns distinct employee_id from shift_assignments for the first shift matching org/site/date/shift_code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFirstShiftIdForCockpit } from "@/lib/server/getCockpitReadiness";

export type GetRosterEmployeeIdsParams = {
  orgId: string;
  siteId: string | null;
  date: string;
  shift_code: string;
};

export async function getRosterEmployeeIdsForShift(
  supabase: SupabaseClient,
  params: GetRosterEmployeeIdsParams
): Promise<string[]> {
  const { orgId, date, shift_code } = params;
  const siteId = params.siteId ?? null;
  if (!date?.trim() || !shift_code?.trim()) return [];

  const shiftId = await getFirstShiftIdForCockpit(supabase, {
    orgId,
    siteId,
    date,
    shift_code: shift_code.trim(),
  });
  if (!shiftId) return [];

  const { data: saRows } = await supabase
    .from("shift_assignments")
    .select("employee_id")
    .eq("shift_id", shiftId)
    .eq("org_id", orgId);

  const ids = [
    ...new Set(
      (saRows ?? [])
        .map((r: { employee_id: string | null }) => r.employee_id)
        .filter((id): id is string => id != null && id !== "")
    ),
  ];
  return ids;
}
