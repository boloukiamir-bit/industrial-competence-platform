import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ComplianceItem = {
  code: string;
  name: string;
  status: "MISSING" | "EXPIRED";
  valid_to: string | null;
  days_left: number | null;
};

type EmployeeBlocker = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  items: ComplianceItem[];
};

function toDateOnly(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function employeeDisplayName(row: { first_name?: string | null; last_name?: string | null; employee_number?: string | null }): string {
  const first = (row.first_name ?? "").trim();
  const last = (row.last_name ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return (row.employee_number ?? "—") as string;
}

export async function GET(request: NextRequest) {
  let pendingCookies: Parameters<typeof applySupabaseCookies>[1] = [];
  try {
    const { supabase, pendingCookies: pc } = await createSupabaseServerClient(request);
    pendingCookies = pc;
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim() ?? "";
    const shiftCode = searchParams.get("shift_code")?.trim() ?? "";
    const stationId = searchParams.get("station_id")?.trim() ?? "";

    if (!date || !shiftCode || !stationId) {
      const res = NextResponse.json(
        { ok: false, error: "date, shift_code, and station_id are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const res = NextResponse.json(
        { ok: false, error: "date must be YYYY-MM-DD" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let shiftQuery = supabaseAdmin
      .from("shifts")
      .select("id, shift_date, shift_code, site_id")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode);
    if (org.activeSiteId) {
      shiftQuery = shiftQuery.or(`site_id.eq.${org.activeSiteId},site_id.is.null`);
    }
    const { data: shiftRows, error: shiftErr } = await shiftQuery;
    if (shiftErr) {
      console.error("[cockpit/issues/compliance-drilldown] shifts query error:", shiftErr);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load shifts" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shifts = (shiftRows ?? []) as Array<{ id: string; shift_date: string | null }>;
    if (shifts.length === 0) {
      const res = NextResponse.json({
        ok: true,
        station_id: stationId,
        shift_date: date,
        shift_code: shiftCode,
        blockers: [],
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftDate = (shifts[0]?.shift_date ?? date) as string;
    const shiftDateObj = toDateOnly(shiftDate) ?? toDateOnly(date);
    if (!shiftDateObj) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift_date in shifts" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftIds = shifts.map((s) => s.id);
    const { data: saRows, error: saErr } = await supabaseAdmin
      .from("shift_assignments")
      .select("employee_id")
      .eq("org_id", org.activeOrgId)
      .eq("station_id", stationId)
      .in("shift_id", shiftIds);
    if (saErr) {
      console.error("[cockpit/issues/compliance-drilldown] shift_assignments query error:", saErr);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load assignments" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeIds = [...new Set((saRows ?? []).map((r) => (r as { employee_id: string }).employee_id))];
    if (employeeIds.length === 0) {
      const res = NextResponse.json({
        ok: true,
        station_id: stationId,
        shift_date: shiftDate,
        shift_code: shiftCode,
        blockers: [],
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: empRows, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, employee_number, first_name, last_name")
      .eq("org_id", org.activeOrgId)
      .in("id", employeeIds);
    if (empErr) {
      console.error("[cockpit/issues/compliance-drilldown] employees query error:", empErr);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load employees" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let catalogQuery = supabaseAdmin
      .from("compliance_catalog")
      .select("id, code, name")
      .eq("org_id", org.activeOrgId)
      .eq("is_active", true)
      .eq("is_blocking", true);
    if (org.activeSiteId) {
      catalogQuery = catalogQuery.or(`site_id.eq.${org.activeSiteId},site_id.is.null`);
    }
    const { data: catalogRows, error: catalogErr } = await catalogQuery;
    if (catalogErr) {
      console.error("[cockpit/issues/compliance-drilldown] compliance_catalog query error:", catalogErr);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load compliance catalog" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalog = (catalogRows ?? []) as Array<{ id: string; code: string; name: string }>;
    if (catalog.length === 0) {
      const res = NextResponse.json({
        ok: true,
        station_id: stationId,
        shift_date: shiftDate,
        shift_code: shiftCode,
        blockers: [],
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const complianceIds = catalog.map((c) => c.id);
    const { data: ecRows, error: ecErr } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived")
      .eq("org_id", org.activeOrgId)
      .in("employee_id", employeeIds)
      .in("compliance_id", complianceIds);
    if (ecErr) {
      console.error("[cockpit/issues/compliance-drilldown] employee_compliance query error:", ecErr);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load employee compliance" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const complianceById = new Map(catalog.map((c) => [c.id, c]));
    const complianceByEmployee = new Map<
      string,
      Map<string, { valid_to: string | null; waived: boolean }>
    >();
    for (const row of ecRows ?? []) {
      const r = row as { employee_id: string; compliance_id: string; valid_to: string | null; waived: boolean };
      if (!complianceByEmployee.has(r.employee_id)) {
        complianceByEmployee.set(r.employee_id, new Map());
      }
      complianceByEmployee.get(r.employee_id)!.set(r.compliance_id, {
        valid_to: r.valid_to ?? null,
        waived: r.waived ?? false,
      });
    }

    const msDay = 1000 * 60 * 60 * 24;
    const blockers: EmployeeBlocker[] = [];
    for (const emp of empRows ?? []) {
      const e = emp as { id: string; employee_number?: string | null; first_name?: string | null; last_name?: string | null };
      const itemMap = complianceByEmployee.get(e.id) ?? new Map();
      const items: ComplianceItem[] = [];
      for (const c of catalog) {
        const rec = itemMap.get(c.id);
        if (rec?.waived) continue;
        if (!rec || rec.valid_to == null) {
          items.push({
            code: c.code,
            name: c.name,
            status: "MISSING",
            valid_to: null,
            days_left: null,
          });
          continue;
        }
        const validToDate = toDateOnly(rec.valid_to);
        if (!validToDate) {
          items.push({
            code: c.code,
            name: c.name,
            status: "MISSING",
            valid_to: null,
            days_left: null,
          });
          continue;
        }
        if (validToDate < shiftDateObj) {
          const daysLeft = Math.ceil((validToDate.getTime() - shiftDateObj.getTime()) / msDay);
          items.push({
            code: c.code,
            name: c.name,
            status: "EXPIRED",
            valid_to: rec.valid_to,
            days_left: daysLeft,
          });
        }
      }
      if (items.length > 0) {
        blockers.push({
          employee_id: e.id,
          employee_number: e.employee_number ?? null,
          employee_name: employeeDisplayName(e),
          items,
        });
      }
    }

    const res = NextResponse.json({
      ok: true,
      station_id: stationId,
      shift_date: shiftDate,
      shift_code: shiftCode,
      blockers,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/compliance-drilldown] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load compliance drilldown" },
      { status: 500 }
    );
  }
}
