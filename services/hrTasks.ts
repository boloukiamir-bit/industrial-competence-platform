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

export type HrTaskBuckets = {
  overdue: HrTask[];
  today: HrTask[];
  upcoming: HrTask[];
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

  return {
    overdue,
    today: todayBucket,
    upcoming,
  };
}

function calculateStepDueDate(startDate: string, daysFromStart: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + daysFromStart);
  return start.toISOString().slice(0, 10);
}
