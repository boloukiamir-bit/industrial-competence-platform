/**
 * POST /api/roster/apply
 * Apply roster for a specific date + shift_code: populate shift_assignments.employee_id from employee_roster_assignments.
 * Body: { date: 'YYYY-MM-DD', shift_code: 'S1'|'S2'|'S3', line: 'all'|<area_code> }.
 * Maps roster shift_code '1'->S1, '2'->S2, '3'->S3. Resolves employee_id (employees.employee_number = employee_anst_id), station_id; updates assignments. Idempotent.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const ROSTER_SHIFT_MAP: Record<string, string> = {
  "1": "S1",
  "2": "S2",
  "3": "S3",
};

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = auth.activeOrgId;
    const siteId = auth.activeSiteId;
    if (!siteId) {
      const res = NextResponse.json(
        { error: "Active site is required for roster apply. Set active_site_id on your profile." },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const date = parseDate((body as { date?: unknown }).date);
    const shiftCode = typeof (body as { shift_code?: unknown }).shift_code === "string"
      ? (body as { shift_code: string }).shift_code.trim()
      : null;
    const line = typeof (body as { line?: unknown }).line === "string"
      ? (body as { line: string }).line.trim() || "all"
      : "all";

    if (!date || !shiftCode) {
      const res = NextResponse.json(
        { error: "date (YYYY-MM-DD) and shift_code (S1|S2|S3) are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const validShiftCodes = ["S1", "S2", "S3"];
    if (!validShiftCodes.includes(shiftCode)) {
      const res = NextResponse.json(
        { error: "shift_code must be S1, S2, or S3" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rosterRows = await supabase
      .from("employee_roster_assignments")
      .select("id, employee_anst_id, employee_name, area, station_code, station_id, shift_code")
      .eq("org_id", orgId)
      .eq("site_id", siteId);

    if (rosterRows.error) {
      console.error("[roster/apply] roster query error:", rosterRows.error);
      const res = NextResponse.json(
        { ok: false, error: rosterRows.error.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const unmappedShiftCodes = new Set<string>();
    const filtered: Array<{
      id: string;
      employee_anst_id: string;
      employee_name: string | null;
      area: string | null;
      station_code: string | null;
      station_id: string | null;
    }> = [];

    for (const row of rosterRows.data ?? []) {
      const r = row as { shift_code?: string; id: string; employee_anst_id: string; employee_name: string | null; area: string | null; station_code: string | null; station_id: string | null };
      const rosterShift = (r.shift_code ?? "").trim();
      const mapped = rosterShift ? (ROSTER_SHIFT_MAP[rosterShift] ?? null) : null;
      if (rosterShift && !mapped) {
        unmappedShiftCodes.add(rosterShift);
        continue;
      }
      if (mapped !== shiftCode) continue;
      if (line !== "all") {
        const rowArea = (r.area ?? "").trim().toUpperCase();
        const lineUpper = line.toUpperCase();
        if (rowArea !== lineUpper) continue;
      }
      filtered.push({
        id: r.id,
        employee_anst_id: r.employee_anst_id,
        employee_name: r.employee_name,
        area: r.area,
        station_code: r.station_code,
        station_id: r.station_id,
      });
    }

    const anstIds = [...new Set(filtered.map((r) => r.employee_anst_id))];
    const { data: employees } = await supabase
      .from("employees")
      .select("id, employee_number")
      .eq("org_id", orgId)
      .or(`site_id.eq.${siteId},site_id.is.null`)
      .in("employee_number", anstIds);
    const empByAnst = new Map<string, string>();
    for (const e of employees ?? []) {
      const emp = e as { id: string; employee_number: string };
      empByAnst.set(emp.employee_number, emp.id);
    }

    const { data: areaRows } = await supabase
      .from("areas")
      .select("id, code")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("is_active", true);
    const areaIds = (areaRows ?? []).map((a: { id: string }) => a.id);
    const areaByCode = new Map<string, string>();
    for (const a of areaRows ?? []) {
      const aa = a as { id: string; code: string };
      if (aa.code) areaByCode.set(aa.code.trim().toUpperCase(), aa.id);
    }

    const missingEmployees: string[] = [];
    const missingStations: string[] = [];
    const resolved: Array<{ employee_id: string; station_id: string; area_id: string | null }> = [];

    for (const row of filtered) {
      const employeeId = empByAnst.get(row.employee_anst_id) ?? null;
      if (!employeeId) {
        missingEmployees.push(row.employee_anst_id);
        continue;
      }
      let stationId: string | null = row.station_id;
      if (!stationId && row.station_code && areaIds.length > 0) {
        const { data: st } = await supabase
          .from("stations")
          .select("id, area_id")
          .eq("org_id", orgId)
          .eq("code", row.station_code)
          .in("area_id", areaIds)
          .eq("is_active", true)
          .maybeSingle();
        if (st?.id) stationId = (st as { id: string }).id;
      }
      if (!stationId) {
        missingStations.push(row.station_code ?? row.employee_anst_id);
        continue;
      }
      let areaId: string | null = null;
      const { data: stationRow } = await supabase
        .from("stations")
        .select("area_id")
        .eq("id", stationId)
        .maybeSingle();
      if (stationRow?.area_id) areaId = stationRow.area_id as string;
      resolved.push({ employee_id: employeeId, station_id: stationId, area_id: areaId });
    }

    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, area_id")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode);

    const shiftsList = (shifts ?? []) as Array<{ id: string; area_id: string | null }>;
    let shiftIds = shiftsList.map((s) => s.id);
    if (line !== "all") {
      const lineAreaId = areaByCode.get(line.toUpperCase()) ?? null;
      if (lineAreaId) {
        shiftIds = shiftsList.filter((s) => s.area_id === lineAreaId).map((s) => s.id);
      }
    }

    const stationIds = [...new Set(resolved.map((r) => r.station_id))];
    const rosterSample = resolved.slice(0, 5).map((r) => ({
      employee_id: r.employee_id,
      station_id: r.station_id,
    }));

    console.log("[roster/apply] org_id:", orgId, "site_id:", siteId);
    console.log("[roster/apply] shift_date:", date, "shift_code:", shiftCode);
    console.log("[roster/apply] resolved_shift_ids:", shiftIds);
    console.log(
      "[roster/apply] station_ids_count:",
      stationIds.length,
      "station_ids_sample:",
      stationIds.slice(0, 5)
    );
    console.log(
      "[roster/apply] roster_rows_count:",
      resolved.length,
      "roster_rows_sample:",
      rosterSample
    );
    console.log("[roster/apply] update_match_keys:", {
      org_id: orgId,
      site_id: siteId,
      shift_id: shiftIds[0] ?? null,
      station_id: stationIds[0] ?? null,
    });

    const candidateCounts: Array<{ shift_id: string; count: number }> = [];
    for (const shiftId of shiftIds) {
      let countQuery = supabase
        .from("shift_assignments")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("site_id", siteId)
        .eq("shift_id", shiftId);
      if (stationIds.length > 0) {
        countQuery = countQuery.in("station_id", stationIds);
      }
      const { count, error: countErr } = await countQuery;
      if (countErr) {
        console.error("[roster/apply] candidate_count error:", countErr);
        candidateCounts.push({ shift_id: shiftId, count: 0 });
        continue;
      }
      candidateCounts.push({ shift_id: shiftId, count: count ?? 0 });
    }

    const candidateCount = candidateCounts.reduce((sum, row) => sum + row.count, 0);
    console.log("[roster/apply] candidate_count:", candidateCount, "by_shift_id:", candidateCounts);

    let shiftIdDistribution: Array<{ shift_id: string; count: number }> = [];
    if (stationIds.length > 0) {
      const { data: shiftIdRows, error: distErr } = await supabase
        .from("shift_assignments")
        .select("shift_id")
        .eq("org_id", orgId)
        .eq("site_id", siteId)
        .in("station_id", stationIds);
      if (distErr) {
        console.error("[roster/apply] shift_id distribution error:", distErr);
      } else {
        const counts = new Map<string, number>();
        for (const row of shiftIdRows ?? []) {
          const shiftId = (row as { shift_id?: string }).shift_id ?? "unknown";
          counts.set(shiftId, (counts.get(shiftId) ?? 0) + 1);
        }
        shiftIdDistribution = Array.from(counts.entries())
          .map(([shift_id, count]) => ({ shift_id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }
    }
    console.log("[roster/apply] shift_id_distribution:", shiftIdDistribution);

    const shiftIdByAreaId = new Map<string, string>();
    for (const shift of shiftsList) {
      if (shift.area_id) shiftIdByAreaId.set(shift.area_id, shift.id);
    }
    const defaultShiftId = shiftIds.length === 1 ? shiftIds[0] : null;
    const missingShiftForStation: string[] = [];

    const upsertPayload = resolved.flatMap((row) => {
      const areaId = row.area_id ?? null;
      const shiftId = areaId ? shiftIdByAreaId.get(areaId) ?? null : defaultShiftId;
      if (!shiftId) {
        missingShiftForStation.push(row.station_id);
        return [];
      }
      return [
        {
          org_id: orgId,
          site_id: siteId,
          shift_id: shiftId,
          station_id: row.station_id,
          employee_id: row.employee_id,
          assignment_date: date,
          status: "assigned",
          updated_at: new Date().toISOString(),
        },
      ];
    });

    const { data: upsertedRows, error: upsertErr } = await supabase
      .from("shift_assignments")
      .upsert(upsertPayload, {
        onConflict: "org_id,site_id,shift_id,station_id",
        ignoreDuplicates: false,
      })
      .select("id");

    if (upsertErr) {
      console.error("[roster/apply] upsert error:", upsertErr);
      const res = NextResponse.json(
        { ok: false, error: upsertErr.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const upsertedCount = upsertedRows?.length ?? 0;
    const responsePayload = {
      ok: true,
      roster_rows: resolved.length,
      upsert_attempted: upsertPayload.length,
      upserted_count: upsertedCount,
      shift_id_used: shiftIds,
      candidate_count: candidateCount,
      updated_assignments_count: upsertedCount,
      missing_employees: [...new Set(missingEmployees)],
      missing_stations: [...new Set(missingStations)],
      missing_shift_for_station: [...new Set(missingShiftForStation)],
      unmapped_shift_codes: Array.from(unmappedShiftCodes),
    };

    if (resolved.length > 0 && upsertedCount === 0) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Roster apply upsert returned 0",
          debug: responsePayload,
        },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(responsePayload);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[roster/apply]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Apply failed" },
      { status: 500 }
    );
  }
}
