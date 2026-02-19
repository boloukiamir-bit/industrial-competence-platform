/**
 * GET /api/cockpit/readiness?shift_id=<uuid>
 * Returns Industrial Readiness Index (v1.1) for the given shift.
 * Unit-level policy binding: if any station has no unit or any unit has no active policy, returns LEGAL_STOP / NO_GO with POLICY_MISSING / UNIT_MISSING.
 * Tenant scope: org_id and site_id from session only (never from query).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getCockpitReadiness } from "@/lib/server/getCockpitReadiness";
import { toPolicyEnvelope, type PolicyEnvelope } from "@/lib/server/policyEnvelope";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";
import { assertExecutionLegitimacy } from "@/lib/server/governance/runtimeGuard";
import { createExecutionToken } from "@/lib/server/governance/executionToken";
import { computePolicyFingerprint } from "@/lib/server/governance/enforceLegitimacy";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReadinessStatus = "GO" | "WARNING" | "NO_GO";

export type ReadinessResponse = {
  ok: true;
  readiness: {
    readiness_score: number;
    status: ReadinessStatus;
    blocking_stations: string[];
    reason_codes: string[];
    calculated_at: string;
  };
  legitimacy_status?: "LEGAL_STOP" | "OK";
  /** Canonical envelope: always { units, compliance }. */
  policy?: PolicyEnvelope;
  execution_token?: string;
};

function isUuid(value: string | null): value is string {
  return typeof value === "string" && value.length === 36 && UUID_RE.test(value);
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const shiftId = request.nextUrl.searchParams.get("shift_id")?.trim() ?? null;
  const dateParam = request.nextUrl.searchParams.get("date")?.trim() ?? null;
  const shiftCodeParam = request.nextUrl.searchParams.get("shift_code")?.trim() ?? null;
  if (!shiftId || !isUuid(shiftId)) {
    const res = NextResponse.json(
      { error: "shift_id is required and must be a valid UUID" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const activeSiteId = org.activeSiteId;
  if (!activeSiteId) {
    const res = NextResponse.json(
      { error: "Active site is required for readiness. Set active_site_id on your profile." },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
      : null;

  const result = await getCockpitReadiness({
    supabase,
    admin,
    orgId: org.activeOrgId,
    siteId: activeSiteId,
    shiftId,
  });

  const runtime = assertExecutionLegitimacy({
    readiness_status: result.readiness_status,
    reason_codes: result.reason_codes,
  });
  if (!runtime.allowed) {
    const res = NextResponse.json(
      { ok: false, error: runtime.error },
      { status: runtime.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let shift_date: string | null = null;
  let shift_code: string | null = null;
  const dateValid = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
  const shiftCodeNormalized = normalizeShiftParam(shiftCodeParam);
  if (dateValid && shiftCodeNormalized) {
    shift_date = dateParam;
    shift_code = shiftCodeNormalized;
  } else if (admin) {
    const { data: shiftRow } = await admin
      .from("shifts")
      .select("shift_date, shift_code")
      .eq("id", shiftId)
      .single();
    if (shiftRow) {
      const row = shiftRow as { shift_date?: string | Date | null; shift_code?: string | null };
      if (row.shift_date != null) {
        shift_date =
          typeof row.shift_date === "string"
            ? /^\d{4}-\d{2}-\d{2}$/.test(row.shift_date)
              ? row.shift_date
              : null
            : row.shift_date instanceof Date
              ? row.shift_date.toISOString().slice(0, 10)
              : null;
      }
      shift_code =
        typeof row.shift_code === "string"
          ? normalizeShiftParam(row.shift_code) ?? row.shift_code
          : null;
    }
  }

  const policyEnvelope = toPolicyEnvelope(result.policy, result.policy_compliance);

  let execution_token: string | undefined;
  if (
    (result.readiness_status === "GO" || result.readiness_status === "WARNING") &&
    process.env.EXECUTION_TOKEN_SECRET
  ) {
    try {
      const policy_fingerprint = computePolicyFingerprint(
        result.legitimacy_status,
        result.reason_codes,
        policyEnvelope
      );
      execution_token = createExecutionToken({
        org_id: org.activeOrgId,
        site_id: activeSiteId,
        shift_code: shift_code ?? null,
        shift_date: shift_date ?? null,
        readiness_status: result.readiness_status,
        policy_fingerprint,
        calculated_at: result.calculated_at,
        issued_at: Date.now(),
        allowed_actions: ["COCKPIT_DECISION_CREATE"],
      });
    } catch {
      // omit token if secret missing or creation fails
    }
  }

  const res = NextResponse.json(
    {
      ok: true,
      readiness: {
        readiness_score: result.readiness_score,
        status: result.readiness_status,
        blocking_stations: result.blocking_stations,
        reason_codes: result.reason_codes,
        calculated_at: result.calculated_at,
      },
      legitimacy_status: result.legitimacy_status,
      policy: policyEnvelope,
      ...(execution_token != null && { execution_token }),
    } satisfies ReadinessResponse,
    { status: 200 }
  );
  applySupabaseCookies(res, pendingCookies);
  return res;
}
