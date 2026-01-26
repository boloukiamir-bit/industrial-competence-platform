import { supabase } from "@/lib/supabaseClient";
import { getWorkflowInstances, WORKFLOW_TEMPLATES } from "./hrWorkflows";
import type { HRWorkflowInstance } from "@/types/domain";

export type HrTask = {
  id: string;
  stepTitle: string;
  status: string;
  dueDate: string | null;
  workflowInstanceId: string;
  workflowName: string;
  workflowCategory: string | null;
  employeeId: string | null;
  employeeName: string | null;
};

export type ExpiringItem = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  type: "medical" | "cert";
  item_name: string;
  expires_on: string;
  days_to_expiry: number;
  severity: "P0" | "P1" | "P2";
};

export type HrTaskBuckets = {
  overdue: HrTask[];
  today: HrTask[];
  upcoming: HrTask[];
  expiring: ExpiringItem[];
  expiringMeta?: {
    medical_count: number;
    cert_count: number;
    total_count: number;
  };
};

function normalize(d: string) {
  return new Date(`${d}T00:00:00`);
}

export async function getHrTaskBuckets(): Promise<HrTaskBuckets> {
  const instances = await getWorkflowInstances({ status: "active" });
  
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00`);
  const sevenDaysAhead = new Date(todayDate);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

  const overdue: HrTask[] = [];
  const todayBucket: HrTask[] = [];
  const upcoming: HrTask[] = [];

  for (const instance of instances) {
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === instance.templateId);
    
    for (const step of instance.steps) {
      if (step.isCompleted) continue;

      const dueDate = instance.startedAt
        ? calculateStepDueDate(instance.startedAt, step.daysFromStart)
        : null;

      const task: HrTask = {
        id: step.id,
        stepTitle: step.title,
        status: step.isCompleted ? "done" : "not_started",
        dueDate,
        workflowInstanceId: instance.id,
        workflowName: instance.templateName || template?.name || "Workflow",
        workflowCategory: template?.category || null,
        employeeId: instance.employeeId,
        employeeName: instance.employeeName || null,
      };

      if (!dueDate) continue;

      const due = normalize(dueDate);

      if (due < todayDate) {
        overdue.push(task);
      } else if (due.getTime() === todayDate.getTime()) {
        todayBucket.push(task);
      } else if (due > todayDate && due <= sevenDaysAhead) {
        upcoming.push(task);
      }
    }
  }

  overdue.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  todayBucket.sort((a, b) => a.stepTitle.localeCompare(b.stepTitle));
  upcoming.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

  // Fetch expiring items from API
  let expiring: ExpiringItem[] = [];
  let expiringMeta: { medical_count: number; cert_count: number; total_count: number } | undefined;
  
  try {
    const response = await fetch("/api/hr/tasks");
    if (response.ok) {
      const data = await response.json();
      expiring = data.tasks || [];
      expiringMeta = data.meta;
    }
  } catch (err) {
    console.error("Failed to fetch expiring items:", err);
  }

  return {
    overdue,
    today: todayBucket,
    upcoming,
    expiring,
    expiringMeta,
  };
}

function calculateStepDueDate(startDate: string, daysFromStart: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + daysFromStart);
  return start.toISOString().slice(0, 10);
}
