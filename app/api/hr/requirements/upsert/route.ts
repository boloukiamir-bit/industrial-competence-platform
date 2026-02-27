/**
 * POST /api/hr/requirements/upsert
 * Upsert employee requirement binding. Auth: requireAdminOrHr. Tenant: session active org/site.
 * Calls supabase.rpc("upsert_employee_requirement_binding_v1", …). Governance logged by RPC.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const VALID_STATUS_OVERRIDES = ["GO", "WARNING", "ILLEGAL"] as const;

type UpsertBody = {
  employee_id?: string;
  requirement_code?: string;
  requirement_name?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  status_override?: string | null;
  evidence_url?: string | null;
  note?: string | null;
  idempotency_key?: string | null;
};

function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = typeof v === "string" ? v.trim() : String(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: UpsertBody = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    const res = NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  const requirement_code = typeof body.requirement_code === "string" ? body.requirement_code.trim() : "";
  const requirement_name = typeof body.requirement_name === "string" ? body.requirement_name.trim() : "";
  if (!requirement_code || !requirement_name) {
    const res = NextResponse.json(
      { ok: false, error: "requirement_code and requirement_name are required and non-empty" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!employee_id) {
    const res = NextResponse.json(
      { ok: false, error: "employee_id is required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const valid_from = parseDate(body.valid_from);
  const valid_to = parseDate(body.valid_to);
  if (valid_from && valid_to && valid_to < valid_from) {
    const res = NextResponse.json(
      { ok: false, error: "valid_to must be >= valid_from when both are set" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const status_override =
    body.status_override == null || body.status_override === ""
      ? null
      : typeof body.status_override === "string"
        ? body.status_override.trim().toUpperCase()
        : null;
  if (status_override !== null && !VALID_STATUS_OVERRIDES.includes(status_override as (typeof VALID_STATUS_OVERRIDES)[number])) {
    const res = NextResponse.json(
      { ok: false, error: "status_override must be null or one of GO, WARNING, ILLEGAL" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const evidence_url =
    body.evidence_url == null || body.evidence_url === ""
      ? null
      : typeof body.evidence_url === "string"
        ? body.evidence_url.trim() || null
        : null;
  const note =
    body.note == null || body.note === ""
      ? null
      : typeof body.note === "string"
        ? body.note.trim() || null
        : null;
  const idempotency_key =
    typeof body.idempotency_key === "string" ? body.idempotency_key.trim() || null : null;

  try {
    const { data, error } = await supabase.rpc("upsert_employee_requirement_binding_v1", {
      p_org_id: auth.activeOrgId,
      p_site_id: auth.activeSiteId,
      p_employee_id: employee_id,
      p_requirement_code: requirement_code,
      p_requirement_name: requirement_name,
      p_valid_from: valid_from,
      p_valid_to: valid_to,
      p_status_override: status_override,
      p_evidence_url: evidence_url,
      p_note: note,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const code = error.code ?? "";
      const msg = error.message ?? "RPC failed";
      if (code === "P0001" && msg.includes("Org mismatch")) {
        const res = NextResponse.json({ ok: false, error: "Organization mismatch" }, { status: 403 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[hr/requirements/upsert] RPC error", error);
      const res = NextResponse.json(
        { ok: false, error: msg || "Failed to upsert binding" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const payload = data as { ok?: boolean; binding_id?: string } | null;
    const binding_id = payload?.binding_id ?? null;
    const res = NextResponse.json({ ok: true, binding_id });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements/upsert] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
