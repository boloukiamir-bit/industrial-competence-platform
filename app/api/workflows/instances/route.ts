import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";

async function getOrgId(request: NextRequest): Promise<string | null> {
  const orgId = request.headers.get("x-org-id");
  if (orgId) return orgId;
  
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get("current_org_id");
  return orgCookie?.value || null;
}

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    
    let query = supabase
      .from("wf_instances")
      .select(`
        id,
        template_id,
        employee_id,
        employee_name,
        status,
        start_date,
        due_date,
        completed_at,
        created_at,
        wf_templates (
          name,
          category
        ),
        wf_instance_tasks (
          id,
          status
        )
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: instances, error } = await query;

    if (error) {
      console.error("Instances fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const instancesWithProgress = (instances || []).map((inst: any) => {
      const tasks = inst.wf_instance_tasks || [];
      const totalTasks = tasks.length;
      const doneTasks = tasks.filter((t: any) => t.status === "done").length;
      
      return {
        id: inst.id,
        templateId: inst.template_id,
        templateName: inst.wf_templates?.name || "Unknown",
        templateCategory: inst.wf_templates?.category || "general",
        employeeId: inst.employee_id,
        employeeName: inst.employee_name,
        status: inst.status,
        startDate: inst.start_date,
        dueDate: inst.due_date,
        completedAt: inst.completed_at,
        createdAt: inst.created_at,
        progress: {
          total: totalTasks,
          done: doneTasks,
          percent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        },
      };
    });

    const statusCounts = {
      active: instancesWithProgress.filter((i: any) => i.status === "active").length,
      completed: instancesWithProgress.filter((i: any) => i.status === "completed").length,
      cancelled: instancesWithProgress.filter((i: any) => i.status === "cancelled").length,
    };

    return NextResponse.json({ instances: instancesWithProgress, statusCounts });
  } catch (err) {
    console.error("Instances error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch instances" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { templateId, employeeId, employeeName, startDate } = body;

    if (!templateId || !employeeId || !employeeName) {
      return NextResponse.json(
        { error: "templateId, employeeId, and employeeName are required" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    const { data: template, error: templateError } = await supabase
      .from("wf_templates")
      .select(`
        id,
        name,
        wf_template_steps (
          step_no,
          title,
          description,
          owner_role,
          default_due_days,
          required
        )
      `)
      .eq("id", templateId)
      .eq("org_id", orgId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const steps = template.wf_template_steps || [];
    const maxDueDays = steps.length > 0 ? Math.max(...steps.map((s: any) => s.default_due_days)) : 30;
    const dueDate = new Date(start.getTime() + maxDueDays * 24 * 60 * 60 * 1000);

    const { data: instance, error: instanceError } = await supabase
      .from("wf_instances")
      .insert({
        org_id: orgId,
        template_id: templateId,
        employee_id: employeeId,
        employee_name: employeeName,
        status: "active",
        start_date: start.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (instanceError) {
      console.error("Instance creation error:", instanceError);
      return NextResponse.json({ error: instanceError.message }, { status: 500 });
    }

    const tasks = steps.map((step: any) => {
      const taskDueDate = new Date(start.getTime() + step.default_due_days * 24 * 60 * 60 * 1000);
      return {
        instance_id: instance.id,
        step_no: step.step_no,
        title: step.title,
        description: step.description,
        owner_role: step.owner_role,
        due_date: taskDueDate.toISOString().split("T")[0],
        status: "todo",
      };
    });

    if (tasks.length > 0) {
      const { error: tasksError } = await supabase
        .from("wf_instance_tasks")
        .insert(tasks);

      if (tasksError) {
        console.error("Tasks creation error:", tasksError);
      }
    }

    await supabase.from("wf_audit_log").insert({
      org_id: orgId,
      entity_type: "instance",
      entity_id: instance.id,
      action: "created",
      metadata: {
        templateId,
        templateName: template.name,
        employeeId,
        employeeName,
        taskCount: tasks.length,
      },
    });

    return NextResponse.json({
      success: true,
      instance: {
        id: instance.id,
        templateName: template.name,
        employeeName,
        status: "active",
        taskCount: tasks.length,
      },
    });
  } catch (err) {
    console.error("Instance creation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create instance" },
      { status: 500 }
    );
  }
}
