/**
 * GET /api/compliance/digest/latest — latest stored digest for org/site. Admin/HR only.
 * Returns single latest row (payload + digest_date) for current org and activeSiteId.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    let q = supabase
      .from("compliance_daily_digests")
      .select("id, digest_date, payload, created_at")
      .eq("org_id", orgId)
      .order("digest_date", { ascending: false })
      .limit(1);
    if (activeSiteId != null) {
      q = q.eq("site_id", activeSiteId);
    } else {
      q = q.is("site_id", null);
    }

    const { data: rows, error } = await q;

    if (error) {
      console.error("GET /api/compliance/digest/latest query", error);
      const res = NextResponse.json(errorPayload("query", error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const row = rows?.[0] ?? null;
    const payload = row?.payload;
    const payloadObj =
      typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : {};
    const res = NextResponse.json({
      ok: true,
      digest: row
        ? {
            id: row.id,
            digest_date: row.digest_date,
            created_at: row.created_at,
            ...payloadObj,
          }
        : null,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/digest/latest failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
