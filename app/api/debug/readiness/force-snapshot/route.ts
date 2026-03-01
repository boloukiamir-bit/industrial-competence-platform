/**
 * POST /api/debug/readiness/force-snapshot
 * Dev-only: force-create a readiness snapshot with minimal deterministic payload.
 * Uses same 1-min reuse and insert_readiness_snapshot_chained RPC as freeze flow.
 * 404 in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import {
  createReadinessSnapshotWithPayload,
  type ReadinessSnapshotPayload,
} from "@/lib/server/readiness/freezeReadinessSnapshot";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MINIMAL_PAYLOAD: ReadinessSnapshotPayload = {
  legal_flag: "LEGAL_GO",
  ops_flag: "OPS_GO",
  overall_status: "GO",
  iri_score: 100,
  iri_grade: "A",
  overall_reason_codes: [],
  legal_blockers_sample: [],
  ops_no_go_stations_sample: [],
  engines: {
    readiness: "TEST",
    compliance: "TEST",
    competence: "TEST",
    iri: "IRI_V1",
  },
  roster_employee_count: 0,
  version: "IRI_V1",
};

function todayYYYYMMDD(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getAdmin();
  if (!admin) {
    const res = NextResponse.json(
      { ok: false, error: "Service unavailable" },
      { status: 503 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const url = new URL(request.url);
  const dateParam = (url.searchParams.get("date") ?? "").trim() || todayYYYYMMDD();
  const shiftParam = (url.searchParams.get("shift_code") ?? "").trim() || "Day";
  const normalized = normalizeShiftParam(shiftParam);
  if (!normalized) {
    const res = NextResponse.json(
      { ok: false, error: "Invalid shift_code", message: "Use Day, Evening, Night, S1, S2, S3" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const res = NextResponse.json(
      { ok: false, error: "Invalid date", message: "Use YYYY-MM-DD" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let siteId = org.activeSiteId ?? null;
  if (!siteId) {
    const { data: firstSite } = await admin
      .from("sites")
      .select("id")
      .eq("org_id", org.activeOrgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstSite?.id) {
      const res = NextResponse.json(
        { ok: false, error: "NO_SITE", message: "No site for this organization" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    siteId = firstSite.id;
  }

  if (!siteId) {
    const res = NextResponse.json(
      { ok: false, error: "NO_SITE", message: "No site for this organization" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const result = await createReadinessSnapshotWithPayload({
      admin,
      orgId: org.activeOrgId,
      siteId,
      userId: org.userId,
      date: dateParam,
      shiftCode: normalized,
      payload: MINIMAL_PAYLOAD,
    });

    const res = NextResponse.json({
      ok: true,
      snapshot_id: result.snapshot_id,
      created_at: result.created_at,
      reused: result.duplicate,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[debug/readiness/force-snapshot]", msg);
    const res = NextResponse.json(
      { ok: false, error: "SNAPSHOT_FAILED", message: msg },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
