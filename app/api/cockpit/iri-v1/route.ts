/**
 * GET /api/cockpit/iri-v1
 * Industrial Readiness Index™ v1 (IRI_V1): deterministic score and grade from readiness-v3.
 *
 * Required: date=YYYY-MM-DD, shift_code=Day|Evening|Night|S1|S2|S3
 * Optional: debug=1
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { computeIRIV1, type LegalFlag, type OpsFlag } from "@/lib/server/readiness/iriV1";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shiftCodeParam = (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  const wantDebug = url.searchParams.get("debug") === "1";

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

  const baseUrl = request.nextUrl.origin;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const params = new URLSearchParams({ date, shift_code: normalized });
  if (wantDebug) params.set("debug", "1");
  const readinessUrl = `${baseUrl}/api/cockpit/readiness-v3?${params.toString()}`;

  try {
    const readinessRes = await fetch(readinessUrl, { headers: { cookie: cookieHeader } });

    if (!readinessRes.ok) {
      const res = NextResponse.json(
        errorPayload("readiness_v3", `HTTP ${readinessRes.status}`, await readinessRes.text()),
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
      _debug?: unknown;
    };

    if (!v3?.ok || !v3.legal || !v3.ops) {
      const res = NextResponse.json(
        errorPayload("readiness_v3", "Response ok/legal/ops missing or invalid"),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const legalFlag = (v3.legal.flag === "LEGAL_GO" ||
      v3.legal.flag === "LEGAL_WARNING" ||
      v3.legal.flag === "LEGAL_NO_GO"
      ? v3.legal.flag
      : "LEGAL_GO") as LegalFlag;
    const opsFlag = (v3.ops.flag === "OPS_GO" ||
      v3.ops.flag === "OPS_WARNING" ||
      v3.ops.flag === "OPS_NO_GO"
      ? v3.ops.flag
      : "OPS_GO") as OpsFlag;

    const legalKpis = v3.legal.kpis ?? {};
    const opsKpis = v3.ops.kpis ?? {};
    const iri = computeIRIV1(legalFlag, legalKpis, opsFlag, opsKpis);

    const body = {
      ok: true as const,
      version: "IRI_V1" as const,
      date,
      shift_code: normalized,
      iri_score: iri.score,
      iri_grade: iri.grade,
      breakdown: iri.breakdown,
      legal_flag: legalFlag,
      ops_flag: opsFlag,
      overall_status_from_v3: v3.overall?.status ?? null,
      _debug: wantDebug ? { readiness_v3_debug: v3._debug } : undefined,
    };

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
