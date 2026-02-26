/**
 * GET /api/cockpit/birthdays?days=14 — Next birthdays within the next N days (current year).
 * Auth/org: getActiveOrgFromSession. Scope: active org + active site if set.
 * If employees has no DOB column: supported=false, reasons: ["missing_dob_column"].
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error, supported: false, birthdays: [] },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days")?.trim();
  const days = Math.min(365, Math.max(1, parseInt(daysParam ?? "14", 10) || 14));

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    let query = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, date_of_birth")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (activeSiteId) {
      query = query.or(`site_id.eq.${activeSiteId},site_id.is.null`);
    }
    const { data: rows, error } = await query;

    if (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "undefined_column" || (error.message && /date_of_birth|column.*exist/i.test(error.message))) {
        const res = NextResponse.json({
          ok: true,
          supported: false,
          birthdays: [],
          reasons: ["missing_dob_column"],
        });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      const res = NextResponse.json(errorPayload("employees", error), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + days);
    const year = today.getFullYear();

    type BirthdayRow = {
      employee_id: string;
      employee_name: string;
      employee_number: string;
      line: string | null;
      date: string;
      days_left: number;
    };
    const birthdays: BirthdayRow[] = [];

    for (const row of rows ?? []) {
      const dob = (row as { date_of_birth?: string | null }).date_of_birth;
      if (!dob) continue;
      const d = new Date(dob);
      if (Number.isNaN(d.getTime())) continue;
      const thisYear = new Date(year, d.getMonth(), d.getDate());
      thisYear.setHours(0, 0, 0, 0);
      if (thisYear < today) continue;
      if (thisYear > end) continue;
      const daysLeft = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const name =
        (row as { name?: string }).name ??
        [(row as { first_name?: string }).first_name, (row as { last_name?: string }).last_name].filter(Boolean).join(" ") ??
        (row as { employee_number?: string }).employee_number ??
        (row as { id: string }).id;
      birthdays.push({
        employee_id: (row as { id: string }).id,
        employee_name: name,
        employee_number: (row as { employee_number?: string }).employee_number ?? "",
        line: (row as { line?: string | null }).line ?? null,
        date: `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        days_left: daysLeft,
      });
    }

    birthdays.sort((a, b) => a.date.localeCompare(b.date));

    const res = NextResponse.json({
      ok: true,
      supported: true,
      birthdays,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/cockpit/birthdays failed:", err);
    const res = NextResponse.json({
      ok: true,
      supported: false,
      birthdays: [],
      reasons: ["unexpected_error"],
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
