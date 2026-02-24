/**
 * POST /api/cockpit/regulatory-radar/create-action — create a regulatory action draft as a governance event.
 * Body: { signal_id: string }. Auth via getActiveOrgFromSession. No compliance_actions; audit-proof trace to signal.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

function errorPayload(step: string, error: string) {
  return { ok: false as const, step, error };
}

export async function POST(request: NextRequest) {
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

  let body: { signal_id?: string };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const signal_id = typeof body.signal_id === "string" ? body.signal_id.trim() : "";
  if (!signal_id) {
    const res = NextResponse.json(errorPayload("validation", "signal_id is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: signal, error: signalErr } = await admin
    .from("regulatory_signals")
    .select("id, org_id, title, summary, source_url, source_name, impact_level, effective_date, time_to_impact_days, relevance_score")
    .eq("id", signal_id)
    .eq("org_id", org.activeOrgId)
    .maybeSingle();

  if (signalErr || !signal) {
    const res = NextResponse.json(
      errorPayload("not_found", "not_found"),
      { status: 404 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const s = signal as {
    id: string;
    title: string;
    summary: string | null;
    source_url: string | null;
    source_name: string | null;
    impact_level: string;
    effective_date: string | null;
    time_to_impact_days: number | null;
    relevance_score: number;
  };

  const payload = {
    signal_id: s.id,
    title: s.title,
    summary: s.summary ?? null,
    source_url: s.source_url ?? null,
    source_name: s.source_name ?? null,
    impact_level: s.impact_level,
    effective_date: s.effective_date ?? null,
    relevance_score: s.relevance_score,
    time_to_impact_days: s.time_to_impact_days ?? null,
  };

  const { data: inserted, error: insertErr } = await admin
    .from("governance_events")
    .insert({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId ?? null,
      actor_user_id: org.userId,
      action: "REGULATORY_ACTION_DRAFT_CREATED",
      target_type: "regulatory_signal",
      target_id: s.id,
      outcome: "CREATED",
      legitimacy_status: "OK",
      readiness_status: "N/A",
      reason_codes: [],
      meta: payload,
      policy_fingerprint: null,
      idempotency_key: null,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[regulatory-radar/create-action] governance_events insert", insertErr);
    const res = NextResponse.json(
      errorPayload("insert", insertErr.message),
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const draft_id = (inserted as { id: string }).id;
  const res = NextResponse.json({
    ok: true,
    draft_id,
    audit_url: `/app/admin/audit?id=${draft_id}`,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
