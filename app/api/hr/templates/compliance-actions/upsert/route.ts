/**
 * POST /api/hr/templates/compliance-actions/upsert — create or update a compliance action draft template.
 * Admin/HR only. Body: { id?, scope:'org'|'site', action_type, channel, name, title, body, is_active? }
 * scope=site requires session activeSiteId else 400.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import {
  COMPLIANCE_ACTION_DRAFT_CATEGORY,
  buildCode,
  COMPLIANCE_ACTION_TYPES,
  COMPLIANCE_CHANNELS,
} from "@/lib/hrTemplatesCompliance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json(errorPayload("auth", auth.error), { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const scope = body.scope === "site" ? "site" : "org";
  if (scope === "site" && auth.activeSiteId == null) {
    const res = NextResponse.json(
      errorPayload("validation", "scope=site requires an active site in session"),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const action_type = typeof body.action_type === "string" ? body.action_type.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";

  if (!action_type || !channel || !name || !title) {
    const res = NextResponse.json(
      errorPayload("validation", "action_type, channel, name, title are required"),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (!COMPLIANCE_ACTION_TYPES.includes(action_type as (typeof COMPLIANCE_ACTION_TYPES)[number])) {
    const res = NextResponse.json(errorPayload("validation", "Invalid action_type"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!COMPLIANCE_CHANNELS.includes(channel as (typeof COMPLIANCE_CHANNELS)[number])) {
    const res = NextResponse.json(errorPayload("validation", "Invalid channel"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const site_id = scope === "org" ? null : auth.activeSiteId;
  const codeBase = buildCode(action_type, channel);
  const code = scope === "site" ? `${codeBase}.site` : codeBase;

  const content = {
    template_type: COMPLIANCE_ACTION_DRAFT_CATEGORY,
    action_type,
    channel,
    title,
    body: bodyText,
  };

  const is_active = body.is_active !== false;
  const id = typeof body.id === "string" ? body.id.trim() || undefined : undefined;
  const now = new Date().toISOString();

  try {
    if (id) {
      const { data: existing } = await supabaseAdmin
        .from("hr_templates")
        .select("id, org_id")
        .eq("id", id)
        .single();
      if (!existing || existing.org_id !== auth.activeOrgId) {
        const res = NextResponse.json(errorPayload("not_found", "Template not found"), { status: 404 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      const { error: updateErr } = await supabaseAdmin
        .from("hr_templates")
        .update({
          code,
          name,
          site_id,
          content,
          is_active,
          updated_at: now,
        })
        .eq("id", id)
        .eq("org_id", auth.activeOrgId);

      if (updateErr) {
        const res = NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      const res = NextResponse.json({ ok: true, id });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("hr_templates")
      .insert({
        org_id: auth.activeOrgId,
        site_id,
        code,
        name,
        category: COMPLIANCE_ACTION_DRAFT_CATEGORY,
        content,
        is_active,
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: existing } = await supabaseAdmin
          .from("hr_templates")
          .select("id")
          .eq("org_id", auth.activeOrgId)
          .eq("site_id", site_id)
          .eq("code", code)
          .maybeSingle();
        if (existing) {
          const { error: updateErr } = await supabaseAdmin
            .from("hr_templates")
            .update({ name, content, is_active, updated_at: now })
            .eq("id", existing.id);
          if (!updateErr) {
            const res = NextResponse.json({ ok: true, id: existing.id });
            applySupabaseCookies(res, pendingCookies);
            return res;
          }
        }
      }
      const res = NextResponse.json(errorPayload("insert", insertErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, id: inserted?.id });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/hr/templates/compliance-actions/upsert failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
