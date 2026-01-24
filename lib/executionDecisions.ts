import { createClient } from "@/utils/supabase/client";

export type DecisionType =
  | "resolve_no_go"
  | "accept_risk"
  | "swap_operator"
  | "assign_operator"
  | "call_in"
  | "escalate";

export type TargetType = "line_shift" | "assignment" | "employee" | "shift_assignment";

export async function logExecutionDecision(input: {
  decision_type: DecisionType;
  target_type: TargetType;
  target_id: string; // uuid
  reason?: string | null;
  root_cause?: Record<string, any> | null;
  actions?: Record<string, any> | null;
}) {
  const supabase = createClient();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("active_org_id, active_site_id")
    .single();

  if (profileErr) throw profileErr;
  if (!profile?.active_org_id) {
    throw new Error("Missing active_org_id in profiles");
  }

  const payload = {
    org_id: profile.active_org_id,
    site_id: profile.active_site_id || null,
    decision_type: input.decision_type,
    target_type: input.target_type,
    target_id: input.target_id,
    reason: input.reason ?? null,
    root_cause: input.root_cause ?? null,
    actions: input.actions ?? null,
  };

  const { data, error } = await supabase
    .from("execution_decisions")
    .insert(payload)
    .select("id, created_at")
    .single();

  if (error) {
    // Unique violation => already resolved
    if ((error as any).code === "23505") {
      return { status: "already_resolved" as const };
    }
    console.error("execution_decisions insert error:", error);
    throw error;
  }

  return { status: "created" as const, data };
}
