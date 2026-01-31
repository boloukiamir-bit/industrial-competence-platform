/**
 * GET /api/requirements — stations, skills catalog, requirements, health (DB-view driven).
 * Query: line (filter), search (ILIKE on station code/name).
 * Scope: active_org_id. Auth from request cookies only; 401 only when supabase.auth.getUser() fails.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { applySupabaseCookies, type CookieToSet } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(
  step: string,
  error: { message?: string; details?: string; hint?: string } | string
) {
  const msg = typeof error === "string" ? error : error?.message ?? "Unknown error";
  const details = typeof error === "object" && error !== null && "details" in error ? (error as { details?: string }).details : undefined;
  const hint = typeof error === "object" && error !== null && "hint" in error ? (error as { hint?: string }).hint : undefined;
  return { ok: false as const, step, message: msg, ...(details != null && { details }), ...(hint != null && { hint }) };
}

export async function GET(request: NextRequest) {
  const pendingCookiesRef: { current: CookieToSet[] } = { current: [] };
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    const res = NextResponse.json(errorPayload("config", "Supabase URL and anon key are required"), { status: 500 });
    return res;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        pendingCookiesRef.current.push(...cookiesToSet);
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    const msg = userError?.message ?? "Invalid or expired session";
    console.error("requirements auth failed", { step: "getUser", error: userError ?? msg });
    const res = NextResponse.json(errorPayload("getUser", msg), { status: 401 });
    applySupabaseCookies(res, pendingCookiesRef.current);
    return res;
  }

  try {
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      console.error("requirements query failed", { step: "getActiveOrgFromSession", error: org.error });
      const res = NextResponse.json(errorPayload("getActiveOrgFromSession", org.error), { status: org.status });
      applySupabaseCookies(res, pendingCookiesRef.current);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const { searchParams } = new URL(request.url);
    const line = searchParams.get("line")?.trim() || null;
    const search = searchParams.get("search")?.trim() || null;

    const allLinesQuery = supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null);

    let stationsQuery = supabaseAdmin
      .from("stations")
      .select("id, name, code, line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null)
      .order("line")
      .order("name");

    if (line) {
      stationsQuery = stationsQuery.eq("line", line);
    }
    if (search) {
      stationsQuery = stationsQuery.or(
        `code.ilike.%${search}%,name.ilike.%${search}%`
      );
    }

    const [allLinesRes, stationsResult] = await Promise.all([
      allLinesQuery,
      stationsQuery,
    ]);

    if (allLinesRes.error) {
      console.error("requirements query failed", { step: "lines query", error: allLinesRes.error });
      const res = NextResponse.json(errorPayload("lines query", allLinesRes.error), { status: 500 });
      applySupabaseCookies(res, pendingCookiesRef.current);
      return res;
    }

    const allLines = [...new Set((allLinesRes.data || []).map((r: { line: string | null }) => r.line).filter(Boolean))].sort() as string[];

    const { data: stationsData, error: stationsError } = stationsResult;
    if (stationsError) {
      console.error("requirements query failed", { step: "stations query", error: stationsError });
      const res = NextResponse.json(errorPayload("stations query", stationsError), { status: 500 });
      applySupabaseCookies(res, pendingCookiesRef.current);
      return res;
    }

    const stations = (stationsData || []).map((s: { id: string; name: string | null; code: string | null; line: string | null }) => ({
      id: s.id,
      code: s.code ?? "",
      name: s.name ?? s.code ?? s.id,
      line: s.line ?? "",
    }));

    const stationIds = stations.map((s: { id: string }) => s.id);

    let healthQuery = supabaseAdmin
      .from("v_tomorrows_gaps_station_health")
      .select("station_id, station_code, station_name, eligible_final, risk_tier, req_status, req_skill_count, data_maturity")
      .eq("org_id", activeOrgId);
    if (line) {
      healthQuery = healthQuery.eq("line", line);
    }

    const [skillsRes, requirementsRes, healthRes] = await Promise.all([
      supabaseAdmin
        .from("v_requirement_skill_catalog")
        .select("skill_id, code, name, category")
        .eq("org_id", activeOrgId)
        .order("category")
        .order("code"),
      stationIds.length > 0
        ? supabaseAdmin
            .from("station_skill_requirements")
            .select("station_id, skill_id, required_level")
            .eq("org_id", activeOrgId)
            .in("station_id", stationIds)
        : Promise.resolve({ data: [] as { station_id: string; skill_id: string; required_level: number }[], error: null }),
      healthQuery,
    ]);

    if (skillsRes.error) {
      console.error("requirements query failed", { step: "skills query (v_requirement_skill_catalog)", error: skillsRes.error });
      const res = NextResponse.json(errorPayload("skills query (v_requirement_skill_catalog)", skillsRes.error), { status: 500 });
      applySupabaseCookies(res, pendingCookiesRef.current);
      return res;
    }
    if (requirementsRes.error) {
      console.error("requirements query failed", { step: "requirements query", error: requirementsRes.error });
      const res = NextResponse.json(errorPayload("requirements query", requirementsRes.error), { status: 500 });
      applySupabaseCookies(res, pendingCookiesRef.current);
      return res;
    }
    if (healthRes.error) {
      console.error("requirements query failed", { step: "health query (v_tomorrows_gaps_station_health)", error: healthRes.error });
      const res = NextResponse.json(errorPayload("health query (v_tomorrows_gaps_station_health)", healthRes.error), { status: 500 });
      applySupabaseCookies(res, pendingCookiesRef.current);
      return res;
    }

    const skills = (skillsRes.data || []).map((s: { skill_id: string; code: string | null; name: string | null; category: string | null }) => ({
      skill_id: s.skill_id,
      code: s.code ?? s.skill_id,
      name: s.name ?? s.code ?? s.skill_id,
      category: s.category ?? "OTHER",
    }));

    const requirements = (requirementsRes.data || []).map((r: { station_id: string; skill_id: string; required_level: number }) => ({
      station_id: r.station_id,
      skill_id: r.skill_id,
      required_level: r.required_level ?? 1,
    }));

    const health = (healthRes.data || []).map((h: {
      station_id: string;
      station_code: string;
      station_name: string;
      eligible_final: number;
      risk_tier: string;
      req_status: string;
      req_skill_count: number;
      data_maturity: string;
    }) => ({
      station_code: h.station_code ?? "",
      station_name: h.station_name ?? "",
      station_id: h.station_id,
      eligible_final: h.eligible_final ?? 0,
      risk_tier: h.risk_tier ?? null,
      req_status: h.req_status ?? "PENDING",
      req_skill_count: h.req_skill_count ?? 0,
      data_maturity: h.data_maturity ?? null,
    }));

    const res = NextResponse.json({
      lines: allLines,
      stations,
      skills,
      requirements,
      health,
    });
    applySupabaseCookies(res, pendingCookiesRef.current);
    return res;
  } catch (err) {
    console.error("GET /api/requirements failed:", err);
    const payload = errorPayload("unexpected", err instanceof Error ? err : String(err));
    const res = NextResponse.json(payload, { status: 500 });
    applySupabaseCookies(res, pendingCookiesRef.current);
    return res;
  }
}
