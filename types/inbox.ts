/**
 * Unified HR Inbox item schema.
 * Used by GET /api/hr/inbox for actionable task list.
 */
export type InboxItemKind = "training" | "medical" | "cert" | "contract";

export type InboxItem = {
  id: string;
  kind: InboxItemKind;
  title: string;
  owner_role: string;
  target_employee_id?: string | null;
  target_employee_name?: string | null;
  line?: string | null;
  station_id?: string | null;
  station_name?: string | null;
  shift_code?: string | null;
  shift_date?: string | null;
  due_date?: string | null;
  severity?: "P0" | "P1" | "P2";
  source_decision_id?: string | null;
  status: "open" | "resolved";
  created_at: string;
  /** For resolve API: task_source maps to medical_check | certificate | training */
  task_source: "medical_check" | "certificate" | "training";
  /** For resolve API */
  task_id: string;
};
