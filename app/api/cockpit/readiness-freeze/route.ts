/**
 * POST /api/cockpit/readiness-freeze
 * Execution freeze: persist readiness-v3 + IRI_V1 as immutable snapshot for audit.
 *
 * Body or query: date=YYYY-MM-DD, shift_code=Day|Evening|Night|S1|S2|S3
 * Guardrails: allow freeze even when LEGAL_NO_GO or OPS_NO_GO; prevent duplicate within 1 minute.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DUPLICATE_WINDOW_MINUTES = 1;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  let date = (url.searchParams.get("date") ?? "").trim();
  let shiftCodeParam = (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  if (!date || !shiftCodeParam) {
    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.date === "string") date = body.date.trim();
      if (typeof body?.shift_code === "string") shiftCodeParam = body.shift_code.trim();
    } catch {
      // ignore
    }
  }

  if (!date || !shiftCodeParam) {
    return NextResponse.json(
      { ok: false, error: "SHIFT_CONTEXT_REQUIRED", message: "date and shift_code are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeShiftParam(shiftCodeParam);
  if (!normalized) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid shift parameter",
        message: "shift_code must be one of Day, Evening, Night, S1, S2, S3",
      },
      { status: 400 }
    );
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = org.activeOrgId;
  let siteId = org.activeSiteId ?? null;
  const userId = org.userId;

  if (!siteId) {
    const { data: firstSite } = await supabaseAdmin
      .from("sites")
      .select("id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstSite?.id) {
      const res = NextResponse.json(
        { ok: false, error: "NO_SITE", message: "No site configured for this organization" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    siteId = firstSite.id;
  }

  const baseUrl = request.nextUrl.origin;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const params = new URLSearchParams({ date, shift_code: normalized });

  try {
    const [readinessRes, iriRes] = await Promise.all([
      fetch(`${baseUrl}/api/cockpit/readiness-v3?${params.toString()}`, { headers: { cookie: cookieHeader } }),
      fetch(`${baseUrl}/api/cockpit/iri-v1?${params.toString()}`, { headers: { cookie: cookieHeader } }),
    ]);

    if (!readinessRes.ok) {
      const res = NextResponse.json(
        errorPayload("readiness_v3", `HTTP ${readinessRes.status}`, await readinessRes.text()),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!iriRes.ok) {
      const res = NextResponse.json(
        errorPayload("iri_v1", `HTTP ${iriRes.status}`, await iriRes.text()),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const v3 = (await readinessRes.json()) as {
      ok?: boolean;
      legal?: { flag?: string; kpis?: Record<string, number> };
      ops?: { flag?: string; kpis?: Record<string, number> };
      overall?: { status?: string };
    };
    const iri = (await iriRes.json()) as {
      ok?: boolean;
      iri_score?: number;
      iri_grade?: string;
    };

    if (!v3?.ok || !v3.legal || !v3.ops || !iri?.ok) {
      const res = NextResponse.json(
        errorPayload("engines", "readiness-v3 or iri-v1 response invalid"),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const legalFlag = (v3.legal.flag === "LEGAL_GO" || v3.legal.flag === "LEGAL_WARNING" || v3.legal.flag === "LEGAL_NO_GO"
      ? v3.legal.flag
      : "LEGAL_GO") as string;
    const opsFlag = (v3.ops.flag === "OPS_GO" || v3.ops.flag === "OPS_WARNING" || v3.ops.flag === "OPS_NO_GO"
      ? v3.ops.flag
      : "OPS_GO") as string;
    const overallStatus = v3.overall?.status ?? "GO";
    const iriScore = typeof iri.iri_score === "number" ? iri.iri_score : 0;
    const iriGrade = typeof iri.iri_grade === "string" ? iri.iri_grade : "F";
    const rosterCount = Math.max(0, v3.legal.kpis?.roster_employee_count ?? v3.ops.kpis?.roster_employee_count ?? 0);

    const shiftDate = date;

    const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("readiness_snapshots")
      .select("id, created_at")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("shift_date", shiftDate)
      .eq("shift_code", normalized)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.id) {
      const res = NextResponse.json({
        ok: true as const,
        snapshot_id: recent.id,
        created_at: (recent as { created_at: string }).created_at,
        duplicate: true as const,
        message: "Snapshot already created within the last minute",
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: row, error: insertErr } = await supabaseAdmin
      .from("readiness_snapshots")
      .insert({
        org_id: orgId,
        site_id: siteId,
        shift_date: shiftDate,
        shift_code: normalized,
        legal_flag: legalFlag,
        ops_flag: opsFlag,
        overall_status: overallStatus,
        iri_score: iriScore,
        iri_grade: iriGrade,
        roster_employee_count: rosterCount,
        version: "IRI_V1",
        created_by: userId,
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      const res = NextResponse.json(errorPayload("insert", insertErr), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      ok: true as const,
      snapshot_id: row.id,
      created_at: row.created_at,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
