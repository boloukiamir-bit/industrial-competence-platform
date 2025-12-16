import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { WORKFLOW_TEMPLATES } from "@/services/hrWorkflows";
import type { HRWorkflowInstance, HRWorkflowStep, HRWorkflowTemplateId } from "@/types/domain";

// In-memory storage for workflow instances (development workaround for Supabase schema cache)
const workflowInstances: HRWorkflowInstance[] = [];

export async function GET() {
  return NextResponse.json(workflowInstances);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, employeeId } = body;

    if (!templateId || !employeeId) {
      return NextResponse.json(
        { error: "templateId and employeeId are required" },
        { status: 400 }
      );
    }

    const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

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

    const id = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const instance: HRWorkflowInstance = {
      id,
      templateId: templateId as HRWorkflowTemplateId,
      templateName: template.name,
      employeeId,
      employeeName: employee?.name,
      status: "active",
      startedAt: now.toISOString(),
      currentStep: 0,
      steps,
    };

    workflowInstances.push(instance);

    // Create person_events for workflow steps
    const personEvents = template.defaultSteps.map((step) => {
      const dueDate = new Date(now.getTime() + step.daysFromStart * 24 * 60 * 60 * 1000);
      return {
        employee_id: employeeId,
        event_type: "training",
        title: `[${template.name}] ${step.title}`,
        description: step.description,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
      };
    });

    const { error: eventsError } = await supabase
      .from("person_events")
      .insert(personEvents);

    if (eventsError) {
      console.warn("Failed to create person_events:", eventsError.message);
    }

    return NextResponse.json(instance);
  } catch (err) {
    console.error("Workflow creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
