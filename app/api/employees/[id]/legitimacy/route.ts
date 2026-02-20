/**
 * GET /api/employees/[id]/legitimacy — read-only Employee Legitimacy Profile.
 * Deterministic: no writes. Org/site scoped via getActiveOrgFromSession.
 * Query: date=YYYY-MM-DD (reference date for expiry evaluation).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { evaluateEmployeeLegitimacy } from "@/lib/domain/legitimacy/evaluateEmployeeLegitimacy";
import type { ComplianceStatusForLegitimacy } from "@/lib/domain/legitimacy/evaluateEmployeeLegitimacy";
import { evaluateEmployeeComplianceV2 } from "@/lib/server/compliance/evaluateEmployeeComplianceV2";
import { getInductionStatusForLegitimacy } from "@/lib/server/induction/inductionService";
import type { EvaluatorCellStatus } from "@/lib/server/compliance/evaluateEmployeeComplianceV2";

declare global {
  // eslint-disable-next-line no-var
  var __LEGITIMACY_SUPABASE_ADMIN__: ReturnType<typeof createClient> | undefined;
}

function getSupabaseAdmin() {
  if (typeof globalThis !== "undefined" && globalThis.__LEGITIMACY_SUPABASE_ADMIN__) {
    return globalThis.__LEGITIMACY_SUPABASE_ADMIN__;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function evaluatorStatusToExpiryStatus(s: EvaluatorCellStatus): "VALID" | "WARNING" | "ILLEGAL" {
  if (s === "overdue") return "ILLEGAL";
  if (s === "expiring") return "WARNING";
  return "VALID";
}

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);

  let org: { ok: true; activeOrgId: string; userId: string; activeSiteId: string | null } | { ok: false; error: string; status: 400 | 401 | 403 };

  if (process.env.TEST_LEGITIMACY_MOCK_ORG) {
    try {
      const parsed = JSON.parse(process.env.TEST_LEGITIMACY_MOCK_ORG) as {
        activeOrgId?: string;
        userId?: string;
        activeSiteId?: string | null;
      };
      if (parsed.activeOrgId && parsed.userId !== undefined) {
        org = {
          ok: true,
          activeOrgId: parsed.activeOrgId,
          userId: parsed.userId,
          activeSiteId: parsed.activeSiteId ?? null,
        };
      } else {
        org = await getActiveOrgFromSession(request, supabase);
      }
    } catch {
      org = await getActiveOrgFromSession(request, supabase);
    }
  } else {
    org = await getActiveOrgFromSession(request, supabase);
    if (org.ok) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", org.userId)
        .eq("org_id", org.activeOrgId)
        .eq("status", "active")
        .maybeSingle();
      if (!membership) {
        const res = NextResponse.json(errorPayload("forbidden", "Not an org member"), { status: 403 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }
  }

  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    const res = NextResponse.json(errorPayload("validation", "Employee id required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim() || null;
  const referenceDate = dateParam
    ? (() => {
        const d = new Date(dateParam);
        return isNaN(d.getTime()) ? new Date() : d;
      })()
    : new Date();
  referenceDate.setHours(0, 0, 0, 0);

  try {
    const orgId = org.activeOrgId;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, site_id")
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (empErr) {
      console.error("[api/employees/[id]/legitimacy] employees", empErr);
      const res = NextResponse.json(errorPayload("employee", empErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!employee) {
      const res = NextResponse.json(
        { ok: false, error: "Employee not found", step: "employee" },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const applicableRows = await evaluateEmployeeComplianceV2(supabaseAdmin, {
      orgId,
      siteId: org.activeSiteId ?? null,
      employeeId: id,
      referenceDate,
      expiringDaysDefault: 30,
    });

    const items = applicableRows.map((r) => ({
      requirement_id: r.requirement_id,
      code: r.code,
      name: r.name,
      expiry_date: r.expiry_date,
      reminder_offset_days: r.reminder_offset_days,
      expiry_status: evaluatorStatusToExpiryStatus(r.status),
    }));

    const complianceStatusesForLegitimacy: ComplianceStatusForLegitimacy[] = applicableRows.map((r) =>
      evaluatorStatusToExpiryStatus(r.status)
    );
    const expiryDatesForNearest = applicableRows.map((r) => r.expiry_date).filter((d): d is string => d != null);
    const nearest_expiry_date = expiryDatesForNearest.length > 0 ? expiryDatesForNearest.sort()[0] : null;
    const illegal_count = items.filter((i) => i.expiry_status === "ILLEGAL").length;
    const warning_count = items.filter((i) => i.expiry_status === "WARNING").length;

    const siteIdForInduction = org.activeSiteId ?? (employee as { site_id?: string | null }).site_id ?? null;
    const inductionStatus = await getInductionStatusForLegitimacy(supabaseAdmin, {
      orgId,
      siteId: siteIdForInduction,
      employeeId: id,
    });

    const legitimacy = evaluateEmployeeLegitimacy({
      complianceStatuses: complianceStatusesForLegitimacy,
      inductionStatus,
      disciplinaryRestriction: false,
    });

    const employeeName =
      employee.name ??
      [employee.first_name, employee.last_name].filter(Boolean).join(" ") ??
      "";

    const res = NextResponse.json({
      ok: true,
      employee: {
        id: employee.id,
        name: employeeName || employee.employee_number || employee.id,
        employee_number: employee.employee_number ?? "",
      },
      legitimacy: {
        status: legitimacy.legitimacyStatus,
        blockers: legitimacy.blockers,
        warnings: legitimacy.warnings,
      },
      compliance: {
        items,
        nearest_expiry_date,
        illegal_count,
        warning_count,
      },
      evidence: {
        illegal_items: items.filter((i) => i.expiry_status === "ILLEGAL").map((i) => i.code),
        warning_items: items.filter((i) => i.expiry_status === "WARNING").map((i) => i.code),
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]/legitimacy]", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
