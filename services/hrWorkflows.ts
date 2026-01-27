import { supabase } from "@/lib/supabaseClient";
import type { 
  HRWorkflowTemplate, 
  HRWorkflowTemplateId, 
  HRWorkflowInstance, 
  HRWorkflowStep,
  HRWorkflowStatus 
} from "@/types/domain";

export const WORKFLOW_TEMPLATES: HRWorkflowTemplate[] = [
  {
    id: "sick_leave",
    name: "Sick Leave Follow-up",
    description: "Structured follow-up process for employees on sick leave according to Swedish labor law",
    category: "health",
    defaultSteps: [
      { title: "Day 1 Contact", description: "Manager contacts employee to check in", daysFromStart: 1, responsibleRole: "manager" },
      { title: "Week 1 Review", description: "Assess if return-to-work plan needed", daysFromStart: 7, responsibleRole: "hr" },
      { title: "Day 14 Coordination", description: "Evaluate need for rehab coordination with Försäkringskassan", daysFromStart: 14, responsibleRole: "hr" },
      { title: "Day 30 Meeting", description: "Formal meeting to discuss return or continued leave", daysFromStart: 30, responsibleRole: "manager" },
      { title: "Day 60 Rehab Plan", description: "If applicable, create detailed rehabilitation plan", daysFromStart: 60, responsibleRole: "hr" },
    ],
  },
  {
    id: "rehab",
    name: "Rehabilitation Process",
    description: "Comprehensive rehabilitation plan for returning employees to full capacity",
    category: "health",
    defaultSteps: [
      { title: "Initial Assessment", description: "Assess current capacity and restrictions", daysFromStart: 0, responsibleRole: "hr" },
      { title: "Doctor Consultation", description: "Review medical recommendations", daysFromStart: 3, responsibleRole: "hr" },
      { title: "Workplace Adjustment", description: "Implement necessary workplace adjustments", daysFromStart: 7, responsibleRole: "manager" },
      { title: "Week 2 Check-in", description: "Review progress and adjust if needed", daysFromStart: 14, responsibleRole: "manager" },
      { title: "Week 4 Evaluation", description: "Formal evaluation of rehab progress", daysFromStart: 28, responsibleRole: "hr" },
      { title: "Completion Review", description: "Final assessment and closure", daysFromStart: 56, responsibleRole: "hr" },
    ],
  },
  {
    id: "parental_leave",
    name: "Parental Leave",
    description: "Manage parental leave transitions smoothly for both departure and return",
    category: "leave",
    defaultSteps: [
      { title: "Notification Received", description: "Record parental leave request and planned dates", daysFromStart: 0, responsibleRole: "hr" },
      { title: "Handover Planning", description: "Plan work handover and coverage", daysFromStart: 7, responsibleRole: "manager" },
      { title: "Backfill Decision", description: "Determine if temporary replacement needed", daysFromStart: 14, responsibleRole: "hr" },
      { title: "Pre-departure Meeting", description: "Final handover meeting before leave", daysFromStart: -7, responsibleRole: "manager" },
      { title: "Return Contact", description: "Contact employee 30 days before planned return", daysFromStart: -30, responsibleRole: "hr" },
      { title: "Return Planning", description: "Plan reboarding activities", daysFromStart: -14, responsibleRole: "manager" },
    ],
  },
  {
    id: "reboarding",
    name: "Reboarding",
    description: "Re-integrate employees returning from extended leave",
    category: "lifecycle",
    defaultSteps: [
      { title: "Welcome Back Meeting", description: "Discuss changes and expectations", daysFromStart: 0, responsibleRole: "manager" },
      { title: "System Access Check", description: "Verify all system access is active", daysFromStart: 0, responsibleRole: "hr" },
      { title: "Training Update", description: "Review and schedule any required training updates", daysFromStart: 3, responsibleRole: "manager" },
      { title: "Week 1 Check-in", description: "Discuss how re-integration is going", daysFromStart: 7, responsibleRole: "manager" },
      { title: "30-day Review", description: "Formal review of reboarding success", daysFromStart: 30, responsibleRole: "hr" },
    ],
  },
  {
    id: "onboarding",
    name: "New Employee Onboarding",
    description: "Standard onboarding process for new employees",
    category: "lifecycle",
    defaultSteps: [
      { title: "Pre-start Preparation", description: "Prepare equipment, accounts, and workspace", daysFromStart: -7, responsibleRole: "hr" },
      { title: "Day 1 Welcome", description: "Welcome meeting and office tour", daysFromStart: 0, responsibleRole: "manager" },
      { title: "HR Introduction", description: "Policies, benefits, and compliance training", daysFromStart: 1, responsibleRole: "hr" },
      { title: "Week 1 Check-in", description: "Review first week experience", daysFromStart: 5, responsibleRole: "manager" },
      { title: "30-day Review", description: "Formal review of onboarding progress", daysFromStart: 30, responsibleRole: "manager" },
      { title: "90-day Review", description: "End of probation review", daysFromStart: 90, responsibleRole: "hr" },
    ],
  },
  {
    id: "offboarding",
    name: "Employee Offboarding",
    description: "Standard offboarding process for departing employees",
    category: "lifecycle",
    defaultSteps: [
      { title: "Exit Notice Received", description: "Document resignation or termination details", daysFromStart: 0, responsibleRole: "hr" },
      { title: "Handover Planning", description: "Plan knowledge transfer and handover", daysFromStart: 1, responsibleRole: "manager" },
      { title: "Exit Interview Scheduled", description: "Schedule exit interview if applicable", daysFromStart: 7, responsibleRole: "hr" },
      { title: "Equipment Return", description: "Collect company equipment and access cards", daysFromStart: -2, responsibleRole: "hr" },
      { title: "Final Day Procedures", description: "System access revocation, final paperwork", daysFromStart: 0, responsibleRole: "hr" },
      { title: "Post-departure Cleanup", description: "Archive data, update org charts", daysFromStart: 1, responsibleRole: "hr" },
    ],
  },
];

export function getWorkflowTemplates(): HRWorkflowTemplate[] {
  return WORKFLOW_TEMPLATES;
}

export function getTemplateById(id: HRWorkflowTemplateId): HRWorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

export async function startWorkflow(
  templateId: HRWorkflowTemplateId,
  employeeId: string,
  createdBy?: string,
  notes?: string
): Promise<HRWorkflowInstance | null> {
  const template = getTemplateById(templateId);
  if (!template) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .single();

  const now = new Date();
  const steps: HRWorkflowStep[] = template.defaultSteps.map((step, index) => ({
    id: `step-${index + 1}`,
    title: step.title,
    description: step.description,
    daysFromStart: step.daysFromStart,
    responsibleRole: step.responsibleRole,
    isCompleted: false,
  }));

  const maxDays = Math.max(...template.defaultSteps.map((s) => s.daysFromStart));
  const dueDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

  const instanceData = {
    template_id: templateId,
    template_name: template.name,
    employee_id: employeeId,
    employee_name: employee?.name || null,
    start_date: now.toISOString().split("T")[0],
    due_date: dueDate.toISOString().split("T")[0],
    status: "active" as HRWorkflowStatus,
    steps: steps,
    created_by: createdBy || null,
    notes: notes || null,
  };

  const { data, error } = await supabase
    .from("hr_workflow_instances")
    .insert(instanceData)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to start workflow:", error);
    return null;
  }

  return mapInstanceFromDb(data);
}

export async function getWorkflowInstances(
  filters?: { status?: HRWorkflowStatus; employeeId?: string; templateId?: string }
): Promise<HRWorkflowInstance[]> {
  let query = supabase
    .from("hr_workflow_instances")
    .select("*")
    .order("start_date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (filters?.templateId) {
    query = query.eq("template_id", filters.templateId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(mapInstanceFromDb);
}

export async function getWorkflowById(id: string): Promise<HRWorkflowInstance | null> {
  const { data, error } = await supabase
    .from("hr_workflow_instances")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapInstanceFromDb(data);
}

export async function completeWorkflowStep(
  instanceId: string,
  stepId: string,
  completedBy?: string,
  notes?: string
): Promise<boolean> {
  const instance = await getWorkflowById(instanceId);
  if (!instance) return false;

  const updatedSteps = instance.steps.map((step) => {
    if (step.id === stepId) {
      return {
        ...step,
        isCompleted: true,
        completedAt: new Date().toISOString(),
        completedBy,
        notes,
      };
    }
    return step;
  });

  const allCompleted = updatedSteps.every((s) => s.isCompleted);

  const { error } = await supabase
    .from("hr_workflow_instances")
    .update({
      steps: updatedSteps,
      status: allCompleted ? "completed" : "active",
      completed_at: allCompleted ? new Date().toISOString() : null,
    })
    .eq("id", instanceId);

  return !error;
}

export async function cancelWorkflow(instanceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("hr_workflow_instances")
    .update({ status: "cancelled" })
    .eq("id", instanceId);

  return !error;
}

function mapInstanceFromDb(row: Record<string, unknown>): HRWorkflowInstance {
  return {
    id: row.id as string,
    templateId: row.template_id as HRWorkflowTemplateId,
    templateName: row.template_name as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string | undefined,
    startedAt: (row.start_date as string) ?? new Date().toISOString(),
    dueDate: row.due_date as string | undefined,
    status: row.status as HRWorkflowStatus,
    steps: (row.steps as HRWorkflowStep[]) || [],
    createdBy: row.created_by as string | undefined,
    completedAt: row.completed_at as string | undefined,
    notes: row.notes as string | undefined,
  };
}
