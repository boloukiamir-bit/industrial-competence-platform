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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    
    const { data: instance, error } = await supabase
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
          id,
          name,
          description,
          category
        ),
        wf_instance_tasks (
          id,
          step_no,
          title,
          description,
          owner_role,
          owner_user_id,
          due_date,
          status,
          completed_at,
          completed_by
        )
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error) {
      console.error("Instance fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const { data: auditLog, error: auditError } = await supabase
      .from("wf_audit_log")
      .select("*")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (auditError) {
      console.warn("Audit log fetch error:", auditError);
    }

    const tasks = (instance.wf_instance_tasks || [])
      .sort((a: any, b: any) => a.step_no - b.step_no);

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t: any) => t.status === "done").length;

    return NextResponse.json({
      id: instance.id,
      templateId: instance.template_id,
      templateName: instance.wf_templates?.name || "Unknown",
      templateDescription: instance.wf_templates?.description,
      templateCategory: instance.wf_templates?.category,
      employeeId: instance.employee_id,
      employeeName: instance.employee_name,
      status: instance.status,
      startDate: instance.start_date,
      dueDate: instance.due_date,
      completedAt: instance.completed_at,
      createdAt: instance.created_at,
      tasks,
      progress: {
        total: totalTasks,
        done: doneTasks,
        percent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      auditLog: auditLog || [],
    });
  } catch (err) {
    console.error("Instance error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch instance" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["active", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { data: instance, error } = await supabase
      .from("wf_instances")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("wf_audit_log").insert({
      org_id: orgId,
      entity_type: "instance",
      entity_id: id,
      action: `status_changed_to_${status}`,
      metadata: { newStatus: status },
    });

    return NextResponse.json({ success: true, instance });
  } catch (err) {
    console.error("Instance update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update instance" },
      { status: 500 }
    );
  }
}
