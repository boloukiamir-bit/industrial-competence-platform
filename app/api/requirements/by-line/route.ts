import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

type RequirementRow = {
  station_id: string;
  skill_id: string;
};

type StationRow = {
  id: string;
  name: string;
};

type SkillRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type UpdatePayload = {
  station_id: string;
  required: boolean;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const line = searchParams.get("line")?.trim();

  if (!line) {
    return NextResponse.json({ error: "line is required" }, { status: 400 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();
    if (profileError) {
      throw profileError;
    }
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const activeOrgId = profile.active_org_id as string;

    const { data: stationsData, error: stationsError } = await supabase
      .from("stations")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .eq("line", line)
      .eq("is_active", true)
      .order("name");
    if (stationsError) {
      throw stationsError;
    }
    const stations = (stationsData || []) as StationRow[];

    const { data: skillsData, error: skillsError } = await supabase
      .from("skills")
      .select("id, code, name")
      .eq("org_id", activeOrgId);
    if (skillsError) {
      throw skillsError;
    }
    const skills = (skillsData || []) as SkillRow[];

    let requirements: RequirementRow[] = [];
    const stationIds = stations.map((station) => station.id);
    if (stationIds.length > 0) {
      const { data: reqData, error: reqError } = await supabase
        .from("station_skill_requirements")
        .select("station_id, skill_id")
        .eq("org_id", activeOrgId)
        .in("station_id", stationIds);
      if (reqError) {
        throw reqError;
      }
      requirements = (reqData || []) as RequirementRow[];
    }

    const res = NextResponse.json({
      line,
      skills,
      stations,
      requirements,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("GET /api/requirements/by-line failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { line?: string; updates?: UpdatePayload[] } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const line = body?.line?.trim();
  const updates = Array.isArray(body?.updates) ? body?.updates : [];

  if (!line) {
    return NextResponse.json({ error: "line is required" }, { status: 400 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();
    if (profileError) {
      throw profileError;
    }
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const activeOrgId = profile.active_org_id as string;

    const { data: skillsData, error: skillsError } = await supabase
      .from("skills")
      .select("id, code, name")
      .eq("org_id", activeOrgId);
    if (skillsError) {
      throw skillsError;
    }
    const skills = (skillsData || []) as SkillRow[];
    const safetySkill = skills.find((skill) => skill.code === "SAFETY_INTRO");
    if (!safetySkill) {
      const res = NextResponse.json({ error: "SAFETY_INTRO skill not found" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: stationsData, error: stationsError } = await supabase
      .from("stations")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("line", line)
      .eq("is_active", true);
    if (stationsError) {
      throw stationsError;
    }
    const stationIds = new Set((stationsData || []).map((row: { id?: string }) => row.id as string));

    const invalidStation = updates.find((update) => !stationIds.has(update.station_id));
    if (invalidStation) {
      const res = NextResponse.json({ error: "Invalid station update" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const toUpsert = updates
      .filter((update) => update.required)
      .map((update) => ({
        org_id: activeOrgId,
        station_id: update.station_id,
        skill_id: safetySkill.id,
        required_level: 1,
        is_mandatory: true,
      }));

    const toDelete = updates.filter((update) => !update.required).map((update) => update.station_id);

    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("station_skill_requirements")
        .upsert(toUpsert, { onConflict: "org_id,station_id,skill_id" });
      if (upsertError) {
        throw upsertError;
      }
    }

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("station_skill_requirements")
        .delete()
        .eq("org_id", activeOrgId)
        .eq("skill_id", safetySkill.id)
        .in("station_id", toDelete);
      if (deleteError) {
        throw deleteError;
      }
    }

    const res = NextResponse.json({
      updated: toUpsert.length,
      removed: toDelete.length,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("POST /api/requirements/by-line failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
