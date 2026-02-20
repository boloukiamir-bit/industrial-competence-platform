/**
 * Induction Core service: checkpoints, enroll, complete, get status.
 * All DB access via provided admin client. Deterministic status: RESTRICTED until all required checkpoints completed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InductionCheckpoint {
  id: string;
  org_id: string;
  site_id: string | null;
  code: string;
  name: string;
  stage: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ListCheckpointsParams {
  orgId: string;
  siteId: string | null;
}

export interface EnrollEmployeeParams {
  orgId: string;
  siteId: string;
  employeeId: string;
  userId: string | null;
}

export interface CompleteCheckpointParams {
  orgId: string;
  siteId: string;
  employeeId: string;
  checkpointId: string;
  userId: string | null;
}

export interface GetEmployeeInductionParams {
  orgId: string;
  siteId: string | null;
  employeeId: string;
}

export interface EmployeeInductionResult {
  enrolled: boolean;
  status: "RESTRICTED" | "CLEARED";
  required_count: number;
  completed_count: number;
  remaining: string[];
}

/**
 * Returns active checkpoints applicable to the site: org-wide (site_id null) + site-specific (site_id = active).
 */
export async function listCheckpoints(
  admin: SupabaseClient,
  params: ListCheckpointsParams
): Promise<InductionCheckpoint[]> {
  const { orgId, siteId } = params;
  const { data, error } = await admin
    .from("induction_checkpoints")
    .select("id, org_id, site_id, code, name, stage, sort_order, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(siteId ? `site_id.is.null,site_id.eq.${siteId}` : "site_id.is.null")
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    console.error("[inductionService] listCheckpoints", error);
    return [];
  }
  return (data ?? []) as InductionCheckpoint[];
}

/**
 * Upsert employee_induction to RESTRICTED (enroll or re-enroll).
 */
export async function enrollEmployee(
  admin: SupabaseClient,
  params: EnrollEmployeeParams
): Promise<{ ok: boolean; error?: string }> {
  const { orgId, siteId, employeeId, userId } = params;
  const now = new Date().toISOString();
  const row = {
    org_id: orgId,
    site_id: siteId,
    employee_id: employeeId,
    status: "RESTRICTED",
    enrolled_at: now,
    cleared_at: null,
    created_by: userId,
    updated_at: now,
  };
  const { error } = await admin.from("employee_induction").upsert(row, {
    onConflict: "employee_id",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error("[inductionService] enrollEmployee", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Insert completion (idempotent), then recompute: if all required checkpoints completed, set status CLEARED.
 */
export async function completeCheckpoint(
  admin: SupabaseClient,
  params: CompleteCheckpointParams
): Promise<{ ok: boolean; error?: string; status?: "RESTRICTED" | "CLEARED" }> {
  const { orgId, siteId, employeeId, checkpointId, userId } = params;
  const now = new Date().toISOString();

  const { error: insertErr } = await admin.from("employee_induction_completions").upsert(
    {
      org_id: orgId,
      site_id: siteId,
      employee_id: employeeId,
      checkpoint_id: checkpointId,
      completed_at: now,
      completed_by: userId,
    },
    { onConflict: "employee_id,checkpoint_id", ignoreDuplicates: false }
  );
  if (insertErr) {
    console.error("[inductionService] completeCheckpoint insert", insertErr);
    return { ok: false, error: insertErr.message };
  }

  const required = await listCheckpoints(admin, { orgId, siteId });
  const requiredIds = new Set(required.map((c) => c.id));
  const { data: completions, error: compErr } = await admin
    .from("employee_induction_completions")
    .select("checkpoint_id")
    .eq("employee_id", employeeId)
    .in("checkpoint_id", required.length ? Array.from(requiredIds) : []);
  if (compErr) {
    console.error("[inductionService] completeCheckpoint completions", compErr);
    return { ok: true, status: "RESTRICTED" };
  }
  const completedSet = new Set((completions ?? []).map((r: { checkpoint_id: string }) => r.checkpoint_id));
  const allDone = required.length > 0 && required.every((c) => completedSet.has(c.id));

  if (allDone) {
    const { error: updateErr } = await admin
      .from("employee_induction")
      .update({
        status: "CLEARED",
        cleared_at: now,
        updated_at: now,
      })
      .eq("employee_id", employeeId)
      .eq("org_id", orgId)
      .eq("site_id", siteId);
    if (updateErr) {
      console.error("[inductionService] completeCheckpoint clear", updateErr);
      return { ok: true, status: "RESTRICTED" };
    }
    return { ok: true, status: "CLEARED" };
  }
  return { ok: true, status: "RESTRICTED" };
}

/**
 * Returns induction status for an employee. No row => not enrolled => CLEARED (legacy).
 */
export async function getEmployeeInduction(
  admin: SupabaseClient,
  params: GetEmployeeInductionParams
): Promise<EmployeeInductionResult> {
  const { orgId, siteId, employeeId } = params;

  if (siteId == null || siteId === "") {
    return {
      enrolled: false,
      status: "CLEARED",
      required_count: 0,
      completed_count: 0,
      remaining: [],
    };
  }

  const { data: row, error: rowErr } = await admin
    .from("employee_induction")
    .select("status")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (rowErr || !row) {
    return {
      enrolled: false,
      status: "CLEARED",
      required_count: 0,
      completed_count: 0,
      remaining: [],
    };
  }

  const required = await listCheckpoints(admin, { orgId, siteId });
  if (required.length === 0) {
    return {
      enrolled: true,
      status: (row as { status: string }).status as "RESTRICTED" | "CLEARED",
      required_count: 0,
      completed_count: 0,
      remaining: [],
    };
  }

  const { data: completions, error: compErr } = await admin
    .from("employee_induction_completions")
    .select("checkpoint_id")
    .eq("employee_id", employeeId)
    .in("checkpoint_id", required.map((c) => c.id));
  const completedIds = new Set(
    (compErr ? [] : (completions ?? [])).map((r: { checkpoint_id: string }) => r.checkpoint_id)
  );
  const remaining = required.filter((c) => !completedIds.has(c.id)).map((c) => c.code);
  const status = (row as { status: string }).status as "RESTRICTED" | "CLEARED";

  return {
    enrolled: true,
    status,
    required_count: required.length,
    completed_count: completedIds.size,
    remaining,
  };
}

/**
 * Returns induction status for legitimacy: RESTRICTED if enrolled and not cleared, else CLEARED.
 * Used by legitimacy route (read-only, no writes).
 */
export async function getInductionStatusForLegitimacy(
  admin: SupabaseClient,
  params: { orgId: string; siteId: string | null; employeeId: string }
): Promise<"RESTRICTED" | "CLEARED"> {
  const { orgId, siteId, employeeId } = params;
  if (siteId == null || siteId === "") {
    return "CLEARED";
  }
  const { data: row } = await admin
    .from("employee_induction")
    .select("status")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (!row) return "CLEARED";
  return (row as { status: string }).status === "RESTRICTED" ? "RESTRICTED" : "CLEARED";
}
