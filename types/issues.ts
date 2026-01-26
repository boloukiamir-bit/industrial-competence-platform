export type IssueInboxItem = {
  id: string; // stable; format: `${source}:${nativeId}`
  source: "cockpit" | "hr";
  issue_type: "no_go" | "warning" | "medical_expiring" | "cert_expiring";
  severity: "P0" | "P1" | "P2";
  title: string;
  subtitle: string | null;
  due_date: string | null;
  native_ref: {
    // For cockpit: shift_assignment_id
    shift_assignment_id?: string;
    // For HR: task_source and task_id
    task_source?: "medical_check" | "certificate";
    task_id?: string;
  };
  resolution_status: "resolved" | "snoozed" | null;
  resolution_note: string | null;
  updated_at: string;
};
