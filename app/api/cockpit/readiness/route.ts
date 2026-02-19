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
  policy?: Array<{ unit_id: string; industry_type: string; version: number }>;
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
      policy: result.policy.length ? result.policy : undefined,
    } satisfies ReadinessResponse,
    { status: 200 }
  );
  applySupabaseCookies(res, pendingCookies);
  return res;
}
