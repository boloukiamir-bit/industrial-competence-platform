import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cockpit/shift-ids?date=YYYY-MM-DD&shift_code=S1&line=all
 * Backward compatible: accepts ?shift=... when shift_code is missing.
 * Returns shift IDs for (org/site/date/shift_code), optionally filtered by line.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim();
    const requestedShiftCode = (searchParams.get("shift_code") ?? searchParams.get("shift") ?? "").trim();
    const line = (searchParams.get("line") ?? "all").trim() || "all";

    if (!date) {
      const res = NextResponse.json(
        { ok: false, error: "date is required", step: "validation" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!requestedShiftCode) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "shift_code is required",
          step: "validation",
          details: {
            shift_code: searchParams.get("shift_code"),
            shift: searchParams.get("shift"),
          },
        },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let shiftCodesQuery = supabaseAdmin
      .from("shifts")
      .select("shift_code")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date);

    if (org.activeSiteId) {
      shiftCodesQuery = shiftCodesQuery.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: shiftCodeRows, error: shiftCodesError } = await shiftCodesQuery;
    if (shiftCodesError) {
      console.error("[cockpit/shift-ids] shift codes query error:", shiftCodesError);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch shift codes", step: "query", details: shiftCodesError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const availableShiftCodes = [
      ...new Set(
        (shiftCodeRows ?? [])
          .map((row: { shift_code?: string | null }) => row.shift_code)
          .filter((code): code is string => Boolean(code))
      ),
    ];
    const requestedKey = requestedShiftCode.toLowerCase();
    const shiftCode = availableShiftCodes.find((code) => code.toLowerCase() === requestedKey);

    if (!shiftCode) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[cockpit/shift-ids] rejected unknown shift_code", {
          date,
          requestedShiftCode,
          line,
          availableShiftCodes,
        });
      }
      const res = NextResponse.json(
        {
          ok: false,
          error: "Invalid shift parameter",
          step: "validation",
          details: { shift_code: requestedShiftCode, available_shift_codes: availableShiftCodes },
        },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let shiftsQuery = supabaseAdmin
      .from("shifts")
      .select("id, shift_code, line, shift_date")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode);

    if (org.activeSiteId) {
      shiftsQuery = shiftsQuery.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }
    if (line !== "all") {
      shiftsQuery = shiftsQuery.eq("line", line);
    }

    const { data: rows, error } = await shiftsQuery;
    if (error) {
      console.error("[cockpit/shift-ids] shifts query error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch shift IDs", step: "query", details: error.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shift_ids = (rows ?? []).map(
      (row: { id: string; shift_code?: string | null; line?: string | null; shift_date?: string | null }) => ({
        shift_id: row.id,
        shift_code: row.shift_code ?? shiftCode,
        line: row.line ?? null,
        shift_date: row.shift_date ?? date,
      })
    );

    if (process.env.NODE_ENV !== "production") {
      console.debug("[cockpit/shift-ids] resolved", {
        date,
        requestedShiftCode,
        shiftCode,
        line,
        count: shift_ids.length,
      });
    }

    const res = NextResponse.json({ ok: true, shift_ids });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/shift-ids] error:", err);
    const message = err instanceof Error ? err.message : "Failed to load shift IDs";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}
