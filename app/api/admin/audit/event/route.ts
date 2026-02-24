/**
 * GET /api/admin/audit/event?id=<uuid>
 * Single governance event fetch. Tenant-safe, org admin only.
 * Reads from public.governance_events (NOT audit_logs). Enriches with actor_email.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase configuration");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function isOrgAdmin(supabase: ReturnType<typeof getServiceSupabase>, orgId: string, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
  return data?.role === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error, code: org.status === 401 ? "AUTH_REQUIRED" : "NO_ORG" },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!id || !UUID_RE.test(id)) {
      const res = NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const supabaseAdmin = getServiceSupabase();
    const isAdmin = await isOrgAdmin(supabaseAdmin, org.activeOrgId, org.userId);
    if (!isAdmin) {
      const res = NextResponse.json({ ok: false, error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let query = supabaseAdmin
      .from("governance_events")
      .select("id, org_id, site_id, actor_user_id, action, target_type, target_id, meta, created_at")
      .eq("id", id)
      .eq("org_id", org.activeOrgId);

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: row, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error("[audit/event] governance_events fetch", fetchError);
      const res = NextResponse.json(
        { ok: false, error: "DB_ERROR", message: fetchError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!row) {
      const res = NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let actor_email: string | null = null;
    const actorId = (row as { actor_user_id?: string | null }).actor_user_id;
    if (actorId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", actorId)
        .maybeSingle();
      actor_email = (profile as { email?: string | null } | null)?.email ?? null;
    }

    const event = {
      id: (row as { id: string }).id,
      org_id: (row as { org_id: string }).org_id,
      site_id: (row as { site_id?: string | null }).site_id ?? null,
      action: (row as { action: string }).action,
      target_type: (row as { target_type: string }).target_type,
      target_id: (row as { target_id?: string | null }).target_id ?? null,
      meta: (row as { meta?: unknown }).meta ?? {},
      created_at: (row as { created_at: string }).created_at,
      created_by: actorId ?? null,
      actor_email,
    };

    const res = NextResponse.json({ ok: true, event });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[audit/event]", err);
    const res = NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
    return res;
  }
}
