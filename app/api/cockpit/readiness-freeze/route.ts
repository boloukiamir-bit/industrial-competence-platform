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
import { createOrReuseReadinessSnapshot } from "@/lib/server/readiness/freezeReadinessSnapshot";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  if (!siteId) {
    const res = NextResponse.json(
      { ok: false, error: "NO_SITE", message: "No site configured for this organization" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  try {
    const result = await createOrReuseReadinessSnapshot({
      admin: supabaseAdmin,
      orgId,
      siteId,
      userId,
      date,
      shiftCode: normalized,
      baseUrl: request.nextUrl.origin,
      cookieHeader: request.headers.get("cookie") ?? "",
    });

    const res = NextResponse.json({
      ok: true as const,
      snapshot_id: result.snapshot_id,
      created_at: result.created_at,
      ...(result.duplicate && { duplicate: true as const, message: "Snapshot already created within the last minute" }),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("freeze", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
