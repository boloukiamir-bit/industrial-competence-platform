/**
 * GET /api/cockpit/requirements-summary
 * Cockpit summary breakdown numbers only (no UI changes). Read-only.
 * Auth: getActiveOrgFromSession (org member, consistent with other cockpit endpoints).
 * Tenant: RPC get_requirements_summary_v1 enforces p_org_id = caller active_org_id; site filter (orNull) applied in DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

export async function GET(request: NextRequest) {
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

  try {
    const { data, error } = await supabase.rpc("get_requirements_summary_v1", {
      p_org_id: org.activeOrgId,
      p_site_id: org.activeSiteId ?? null,
    });

    if (error) {
      if (error.code === "P0001" && error.message?.includes("Org mismatch")) {
        const res = NextResponse.json(
          { ok: false, error: "Org mismatch" },
          { status: 403 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[cockpit/requirements-summary] RPC error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch requirements summary" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const payload = data as {
      counts?: {
        total: number;
        illegal: number;
        warning: number;
        go: number;
        blocking_critical: number;
        blocking_high: number;
      };
      top_requirements?: Array<{
        requirement_code: string;
        requirement_name: string;
        illegal: number;
        warning: number;
        total: number;
      }>;
    } | null;

    const res = NextResponse.json({
      ok: true,
      counts: payload?.counts ?? {
        total: 0,
        illegal: 0,
        warning: 0,
        go: 0,
        blocking_critical: 0,
        blocking_high: 0,
      },
      top_requirements: payload?.top_requirements ?? [],
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/requirements-summary] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
