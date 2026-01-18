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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params;
    const orgId = await getOrgId(request);
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { taskId, status, ownerUserId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: instance, error: instanceError } = await supabase
      .from("wf_instances")
      .select("id, org_id")
      .eq("id", instanceId)
      .eq("org_id", orgId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    
    if (status) {
      if (!["todo", "in_progress", "done", "blocked"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = status;
      if (status === "done") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }
    }
    
    if (ownerUserId !== undefined) {
      updates.owner_user_id = ownerUserId;
    }

    const { data: task, error: taskError } = await supabase
      .from("wf_instance_tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("instance_id", instanceId)
      .select()
      .single();

    if (taskError) {
      console.error("Task update error:", taskError);
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    await supabase.from("wf_audit_log").insert({
      org_id: orgId,
      entity_type: "task",
      entity_id: taskId,
      action: status ? `status_changed_to_${status}` : "updated",
      metadata: {
        instanceId,
        taskTitle: task.title,
        newStatus: status,
        ownerUserId,
      },
    });

    const { data: allTasks } = await supabase
      .from("wf_instance_tasks")
      .select("status")
      .eq("instance_id", instanceId);

    const allDone = allTasks && allTasks.length > 0 && allTasks.every((t: any) => t.status === "done");
    
    if (allDone) {
      await supabase
        .from("wf_instances")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", instanceId);

      await supabase.from("wf_audit_log").insert({
        org_id: orgId,
        entity_type: "instance",
        entity_id: instanceId,
        action: "auto_completed",
        metadata: { reason: "All tasks completed" },
      });
    }

    return NextResponse.json({ 
      success: true, 
      task,
      instanceAutoCompleted: allDone
    });
  } catch (err) {
    console.error("Task update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}
