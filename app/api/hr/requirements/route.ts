/**
 * GET /api/hr/requirements
 * HR Inbox "Requirements" tab data source. Read-only.
 * Auth: requireAdminOrHr. Tenant: activeOrgId + activeSiteId (site optional, orNull).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const SEVERITY_ORDER: Record<string, number> = { ILLEGAL: 0, WARNING: 1, GO: 2 };
const CRITICALITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type RequirementStatusRow = {
  org_id: string;
  site_id: string | null;
  employee_id: string;
  employee_name?: string;
  employee_number?: string;
  requirement_code: string;
  requirement_name: string;
  requirement_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  status_override: string | null;
  evidence_url: string | null;
  note: string | null;
  computed_status: string;
  status_reason: string;
  criticality: string;
};

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "").trim().toUpperCase();
  const q = (searchParams.get("q") ?? "").trim();
  const limitRaw = Math.min(
    Math.max(0, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const limit = limitRaw;
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  if (status && !["GO", "WARNING", "ILLEGAL"].includes(status)) {
    const res = NextResponse.json(
      { ok: false, error: "Invalid status; use GO, WARNING, or ILLEGAL" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    let query = supabase
      .from("v_employee_requirement_status")
      .select("*", { count: "exact" })
      .eq("org_id", auth.activeOrgId);

    if (auth.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
    }
    if (status) {
      query = query.eq("computed_status", status);
    }
    if (q.length > 0) {
      const escaped = escapeIlike(q).replace(/,/g, " ");
      const pattern = `%${escaped}%`;
      query = query.or(`requirement_code.ilike.${pattern},requirement_name.ilike.${pattern}`);
    }

    const { data: rows, error, count } = await query
      .order("valid_to", { ascending: true, nullsFirst: true })
      .order("requirement_code", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[hr/requirements] fetch error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch requirements" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const list = (rows ?? []) as RequirementStatusRow[];
    list.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.computed_status] ?? 3;
      const sb = SEVERITY_ORDER[b.computed_status] ?? 3;
      if (sa !== sb) return sa - sb;
      const ca = CRITICALITY_ORDER[a.criticality] ?? 4;
      const cb = CRITICALITY_ORDER[b.criticality] ?? 4;
      if (ca !== cb) return ca - cb;
      const va = a.valid_to ?? "";
      const vb = b.valid_to ?? "";
      if (va !== vb) return va.localeCompare(vb);
      return (a.requirement_code ?? "").localeCompare(b.requirement_code ?? "");
    });

    const employeeIds = [...new Set(list.map((r) => r.employee_id).filter(Boolean))];
    const employeeLookup = new Map<
      string,
      { employee_name: string; employee_number: string | null }
    >();
    if (employeeIds.length > 0) {
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, employee_number")
        .eq("org_id", auth.activeOrgId)
        .in("id", employeeIds);

      if (!empError && employees?.length) {
        for (const e of employees as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          employee_number: string | null;
        }>) {
          const first = (e.first_name ?? "").trim();
          const last = (e.last_name ?? "").trim();
          const employee_name = [first, last].filter(Boolean).join(" ").trim() || null;
          employeeLookup.set(e.id, {
            employee_name: employee_name ?? "",
            employee_number: e.employee_number ?? null,
          });
        }
      }
    }

    const enriched = list.map((r) => {
      const emp = employeeLookup.get(r.employee_id);
      return {
        ...r,
        employee_name: emp?.employee_name,
        employee_number: emp?.employee_number ?? undefined,
      };
    });

    const res = NextResponse.json({
      ok: true,
      rows: enriched,
      total: count ?? list.length,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
