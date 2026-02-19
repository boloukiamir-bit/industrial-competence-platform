/**
 * POST /api/compliance/employee/upsert — set/update one employee compliance. Admin/HR only.
 * Body: { employee_id, compliance_code, valid_from?, valid_to?, evidence_url?, notes?, waived?, date?, shift_code? }
 * Query fallback: ?date=...&shift_code=...
 * Shift context (date + shift_code) required for COMPLIANCE_MUTATION; partial scope returns 400 SHIFT_CONTEXT_INVALID.
 * Governed: requireGovernedMutation + withGovernanceGate; governance_events audit.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";
import { requireGovernedMutation } from "@/lib/server/governance/firewall";
import { withGovernanceGate } from "@/lib/server/governance/withGovernanceGate";
import { isHrAdmin } from "@/lib/auth";

function getAdmin(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

const ROUTE = "/api/compliance/employee/upsert";

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getAdmin();
  const fw = requireGovernedMutation({
    admin,
    governed: true,
    context: { route: ROUTE, action: "COMPLIANCE_MUTATION" },
  });
  if (!fw.ok) {
    const res = NextResponse.json(fw.body, { status: fw.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, activeSiteId, userId } = org;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", activeOrgId)
    .eq("status", "active")
    .maybeSingle();

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(
      { ok: false as const, step: "forbidden", error: "Admin or HR role required" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  const compliance_code = typeof body.compliance_code === "string" ? body.compliance_code.trim() : "";
  if (!employee_id || !compliance_code) {
    const res = NextResponse.json(errorPayload("validation", "employee_id and compliance_code are required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const valid_from = typeof body.valid_from === "string" ? body.valid_from || null : null;
  const valid_to = typeof body.valid_to === "string" ? body.valid_to || null : null;
  const evidence_url = typeof body.evidence_url === "string" ? body.evidence_url.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const waived = body.waived === true;

  const searchParams = request.nextUrl.searchParams;
  const bodyDate = typeof body.date === "string" ? body.date.trim() || null : null;
  const bodyShiftCode = typeof body.shift_code === "string" ? body.shift_code.trim() || null : null;
  const queryDate = searchParams.get("date")?.trim() || null;
  const queryShiftCode = searchParams.get("shift_code")?.trim() || null;
  const dateParam = bodyDate !== null && bodyDate !== "" ? bodyDate : queryDate;
  const shiftCodeParam =
    bodyShiftCode !== null && bodyShiftCode !== "" ? bodyShiftCode : queryShiftCode;

  const hasDate = dateParam != null && dateParam !== "";
  const hasShiftCode = shiftCodeParam != null && shiftCodeParam !== "";
  if (hasDate !== hasShiftCode) {
    const res = NextResponse.json(
      {
        ok: false,
        error: {
          kind: "GOVERNANCE",
          code: "SHIFT_CONTEXT_INVALID",
          message: "Provide both date and shift_code for compliance mutations.",
        },
      },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let normalizedDate: string | undefined;
  let normalizedShiftCode: string | undefined;
  if (hasDate && hasShiftCode) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam!)) {
      const res = NextResponse.json(
        {
          ok: false,
          error: {
            kind: "GOVERNANCE",
            code: "SHIFT_CONTEXT_INVALID",
            message: "Provide both date and shift_code for compliance mutations.",
          },
        },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const normalized = normalizeShiftParam(shiftCodeParam!);
    if (normalized == null || normalized === "") {
      const res = NextResponse.json(
        {
          ok: false,
          error: {
            kind: "GOVERNANCE",
            code: "SHIFT_CONTEXT_INVALID",
            message: "Provide both date and shift_code for compliance mutations.",
          },
        },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    normalizedDate = dateParam!;
    normalizedShiftCode = normalized;
  }

  const target_id = `compliance:${compliance_code}:employee:${employee_id}`;
  const meta: Record<string, unknown> = {
    route: ROUTE,
    item_code: compliance_code,
    employee_id,
    op: "upsert",
  };
  if (normalizedDate != null) meta.date = normalizedDate;
  if (normalizedShiftCode != null) meta.shift_code = normalizedShiftCode;

  try {
    const result = await withGovernanceGate({
      supabase,
      admin: admin!,
      orgId: activeOrgId,
      siteId: activeSiteId,
      context: {
        action: "COMPLIANCE_MUTATION",
        target_type: "compliance",
        target_id,
        meta,
        ...(normalizedDate != null && normalizedShiftCode != null && {
          date: normalizedDate,
          shift_code: normalizedShiftCode,
        }),
      },
      handler: async () => {
        const { data: catalogRow, error: catError } = await admin!
          .from("compliance_catalog")
          .select("id")
          .eq("org_id", activeOrgId)
          .eq("code", compliance_code)
          .eq("is_active", true)
          .maybeSingle();

        if (catError || !catalogRow) {
          return {
            notFound: true as const,
            step: "catalog",
            error: catError?.message ?? "Compliance code not found or inactive",
            details: catError?.details,
          };
        }

        const compliance_id = (catalogRow as { id: string }).id;

        const { data: empRow, error: empError } = await admin!
          .from("employees")
          .select("id, site_id")
          .eq("id", employee_id)
          .eq("org_id", activeOrgId)
          .maybeSingle();

        if (empError) {
          console.error("compliance/employee/upsert employee lookup", empError);
          throw new Error(empError.message);
        }
        if (!empRow) {
          return { notFound: true as const, step: "employee", error: "Employee not found or not in org" };
        }

        const site_id = (empRow as { id: string; site_id: string | null }).site_id ?? null;

        const row = {
          org_id: activeOrgId,
          site_id,
          employee_id,
          compliance_id,
          valid_from: valid_from || null,
          valid_to: valid_to || null,
          evidence_url,
          notes,
          waived,
          updated_at: new Date().toISOString(),
        };

        const { data: raw, error } = await admin!
          .from("employee_compliance")
          .upsert(row as never, { onConflict: "org_id,employee_id,compliance_id", ignoreDuplicates: false })
          .select("id, org_id, site_id, employee_id, compliance_id, valid_from, valid_to, evidence_url, notes, waived, created_at, updated_at")
          .single();

        if (error) {
          console.error("compliance/employee/upsert", { step: "upsert", error });
          throw new Error(error.message);
        }

        type Selected = { id: string; org_id: string; site_id: string | null; employee_id: string; compliance_id: string; valid_from: string | null; valid_to: string | null; evidence_url: string | null; notes: string | null; waived: boolean; created_at: string; updated_at: string };
        const data = raw as Selected | null;
        const item = data
          ? {
              id: data.id,
              org_id: data.org_id,
              site_id: data.site_id ?? null,
              employee_id: data.employee_id,
              compliance_id: data.compliance_id,
              valid_from: data.valid_from ?? null,
              valid_to: data.valid_to ?? null,
              evidence_url: data.evidence_url ?? null,
              notes: data.notes ?? null,
              waived: data.waived,
              created_at: data.created_at,
              updated_at: data.updated_at,
            }
          : null;

        return { item };
      },
    });

    if (!result.ok) {
      const res = NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const data = result.data as { item?: unknown; notFound?: boolean; step?: string; error?: string; details?: string };
    if (data.notFound) {
      const res = NextResponse.json(
        errorPayload(data.step ?? "not_found", data.error, data.details),
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, item: data.item });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST " + ROUTE + " failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
