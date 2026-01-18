import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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
    
    const { data: templates, error } = await supabase
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
          owner_role,
          default_due_days,
          required
        )
      `)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Templates fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const templatesWithCount = (templates || []).map((t: any) => ({
      ...t,
      stepCount: t.wf_template_steps?.length || 0,
      steps: t.wf_template_steps?.sort((a: any, b: any) => a.step_no - b.step_no) || [],
    }));

    return NextResponse.json({ templates: templatesWithCount });
  } catch (err) {
    console.error("Templates error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
