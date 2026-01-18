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
    
    const { data: template, error } = await supabase
      .from("wf_templates")
      .select(`
        id,
        name,
        description,
        category,
        is_active,
        created_at,
        wf_template_steps (
          id,
          step_no,
          title,
          description,
          owner_role,
          default_due_days,
          required
        )
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error) {
      console.error("Template fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({
      ...template,
      steps: template.wf_template_steps?.sort((a: any, b: any) => a.step_no - b.step_no) || [],
    });
  } catch (err) {
    console.error("Template error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch template" },
      { status: 500 }
    );
  }
}
