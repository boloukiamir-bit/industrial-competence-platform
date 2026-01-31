/**
 * POST /api/attendance/upsert
 * Batch upsert attendance: [{ employeeNumber, status, minutes_present? }]
 * Requires admin/hr role (enforced server-side via membership check).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftTypeOrDefault } from "@/lib/shift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const upsertItemSchema = z.object({
  employeeNumber: z.string().min(1),
  status: z.enum(["present", "partial", "absent"]),
  minutes_present: z.number().int().min(0).optional(),
});

const upsertBodySchema = z.object({
  date: z.string(),
  shift: z.string(),
  items: z.array(upsertItemSchema).min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("org_id", org.activeOrgId)
      .eq("user_id", org.userId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["admin", "hr"].includes(membership.role as string)) {
      const res = NextResponse.json({ error: "Admin or HR role required" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json();
    const parsed = upsertBodySchema.safeParse(body);
    if (!parsed.success) {
      const res = NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { date, shift, items } = parsed.data;
    const shiftType = normalizeShiftTypeOrDefault(shift);

    const employeeNumbers = [...new Set(items.map((i) => i.employeeNumber))];
    const { data: employees, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, employee_number")
      .eq("org_id", org.activeOrgId)
      .in("employee_number", employeeNumbers);

    if (empError) {
      console.error("[attendance/upsert] employees query:", empError);
      const res = NextResponse.json({ error: "Failed to resolve employees" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const empByNumber = new Map(
      (employees || []).map((e: { employee_number: string; id: string }) => [e.employee_number, e.id])
    );

    const rows = items
      .filter((i) => empByNumber.has(i.employeeNumber))
      .map((i) => ({
        org_id: org.activeOrgId,
        work_date: date,
        shift_type: shiftType,
        employee_id: empByNumber.get(i.employeeNumber)!,
        status: i.status,
        minutes_present: i.minutes_present ?? null,
        source: "manual",
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      const res = NextResponse.json({ error: "No valid employees found for upsert" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { error: upsertError } = await supabaseAdmin.from("attendance_records").upsert(rows, {
      onConflict: "org_id,work_date,shift_type,employee_id",
      ignoreDuplicates: false,
    });

    if (upsertError) {
      console.error("[attendance/upsert] upsert error:", upsertError);
      const res = NextResponse.json({ error: "Failed to upsert attendance" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, upserted: rows.length });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[attendance/upsert] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
