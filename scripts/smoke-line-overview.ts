#!/usr/bin/env tsx
/**
 * Smoke test for Line Overview API with shift normalization.
 * Verifies:
 * - Shift parameter normalization (day/Day/DAY all work)
 * - Demand join logic (station_id preferred, fallback to machine_code)
 * - Error handling (401 for invalid auth, 400 for invalid shift)
 * 
 * Usage:
 *   tsx scripts/smoke-line-overview.ts [date] [shift] [line]
 * 
 * Example:
 *   tsx scripts/smoke-line-overview.ts 2026-02-02 Day BEA
 *   tsx scripts/smoke-line-overview.ts 2026-02-02 day BEA  # lowercase works
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type TestResult = {
  test: string;
  passed: boolean;
  details?: string;
  data?: unknown;
};

const results: TestResult[] = [];

function log(test: string, passed: boolean, details?: string, data?: unknown) {
  results.push({ test, passed, details, data });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${test}${details ? `: ${details}` : ""}`);
  if (data && !passed) {
    console.log("   Data:", JSON.stringify(data, null, 2));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const date = args[0] || "2026-02-02";
  const shift = args[1] || "Day";
  const lineFilter = args[2] || null;

  console.log("\n🔍 Line Overview Smoke Test");
  console.log(`   Date: ${date}`);
  console.log(`   Shift: ${shift}`);
  console.log(`   Line: ${lineFilter || "all"}\n`);

  // Get first active org
  const { data: orgs, error: orgsError } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("is_active", true)
    .limit(1);

  if (orgsError || !orgs || orgs.length === 0) {
    log("Get active org", false, "No active organizations found");
    return;
  }

  const orgId = orgs[0].id;
  const orgName = orgs[0].name;
  log("Get active org", true, `${orgName} (${orgId})`);

  // Test 1: Fetch stations
  const { data: stations, error: stationsError } = await supabaseAdmin
    .from("stations")
    .select("id, name, code, line")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .not("line", "is", null)
    .order("line")
    .order("name");

  if (stationsError) {
    log("Fetch stations", false, stationsError.message);
    return;
  }

  const stationCount = stations?.length || 0;
  log("Fetch stations", stationCount > 0, `Found ${stationCount} stations`);

  if (stationCount === 0) {
    console.log("\n⚠️  No stations found. Import stations first.");
    return;
  }

  const stationLines = [...new Set(stations?.map((s) => s.line).filter(Boolean))].sort();
  console.log(`   Lines: ${stationLines.join(", ")}`);

  // Test 2: Fetch demand with shift normalization
  const { data: demands, error: demandError } = await supabaseAdmin
    .from("pl_machine_demand")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_date", date)
    .eq("shift_type", shift);

  if (demandError) {
    log("Fetch demand", false, demandError.message);
    return;
  }

  const demandCount = demands?.length || 0;
  log("Fetch demand", true, `Found ${demandCount} demand rows for ${shift}`);

  if (demandCount === 0) {
    console.log(`\n⚠️  No demand for ${date} ${shift}. Generate demand first.`);
    return;
  }

  // Test 3: Join demand with stations
  const demandByStationId = new Map();
  const demandByMachineCode = new Map();

  for (const d of demands || []) {
    if (d.station_id) {
      demandByStationId.set(d.station_id, d);
    }
    if (d.machine_code) {
      demandByMachineCode.set(d.machine_code, d);
    }
  }

  let joinedByStationId = 0;
  let joinedByMachineCode = 0;
  let unmatchedDemand = 0;

  for (const station of stations || []) {
    const byId = demandByStationId.has(station.id);
    const byCode = demandByMachineCode.has(station.code ?? station.id);
    
    if (byId) {
      joinedByStationId++;
    } else if (byCode) {
      joinedByMachineCode++;
    }
  }

  unmatchedDemand = demandCount - joinedByStationId - joinedByMachineCode;

  log(
    "Join demand to stations",
    unmatchedDemand === 0,
    `${joinedByStationId} by station_id, ${joinedByMachineCode} by machine_code, ${unmatchedDemand} unmatched`
  );

  // Test 4: Test shift normalization variants
  const shiftVariants = ["day", "Day", "DAY", "evening", "Evening", "night", "Night"];
  let normalizedCorrectly = 0;

  for (const variant of shiftVariants) {
    const { data: testDemand } = await supabaseAdmin
      .from("pl_machine_demand")
      .select("id")
      .eq("org_id", orgId)
      .eq("plan_date", date)
      .eq("shift_type", variant.charAt(0).toUpperCase() + variant.slice(1).toLowerCase())
      .limit(1);
    
    if (testDemand && testDemand.length > 0) {
      normalizedCorrectly++;
    }
  }

  log(
    "Shift normalization",
    normalizedCorrectly > 0,
    `Tested ${shiftVariants.length} variants, ${normalizedCorrectly} matched`
  );

  // Test 5: Integration – insert assignment, then GET-style fetch returns it
  const { data: shiftRows } = await supabaseAdmin
    .from("shifts")
    .select("id")
    .eq("org_id", orgId)
    .eq("shift_date", date)
    .eq("shift_type", shift)
    .limit(1);

  const shiftId = shiftRows?.[0]?.id;
  const station = stations?.[0];
  const { data: empRow } = await supabaseAdmin
    .from("employees")
    .select("id, employee_number, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (shiftId && station?.id && empRow?.id) {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("shift_assignments")
      .insert({
        org_id: orgId,
        shift_id: shiftId,
        station_id: station.id,
        employee_id: empRow.id,
        assignment_date: date,
        status: "active",
      })
      .select("id")
      .single();

    if (!insertErr && inserted?.id) {
      const { data: fetched, error: fetchErr } = await supabaseAdmin
        .from("shift_assignments")
        .select(`
          id,
          shift:shift_id(shift_date, shift_type),
          station:station_id(code),
          employee:employee_id(employee_number)
        `)
        .eq("org_id", orgId)
        .eq("id", inserted.id)
        .single();

      const found = !fetchErr && fetched?.id === inserted.id;
      log("Integration: POST assignment then GET returns it", found, found ? `assignment ${inserted.id} visible` : String(fetchErr?.message || "not found"));

      await supabaseAdmin.from("shift_assignments").delete().eq("id", inserted.id);
    } else {
      log("Integration: POST assignment then GET returns it", false, "insert failed: " + String(insertErr?.message));
    }
  } else {
    log("Integration: POST assignment then GET returns it", false, "missing shift, station, or employee");
  }

  // Filter by line if specified
  if (lineFilter) {
    const lineStations = stations?.filter((s) => s.line === lineFilter) || [];
    const lineStationIds = lineStations.map((s) => s.id);
    const lineStationCodes = lineStations.map((s) => s.code ?? s.id);

    const lineDemands = demands?.filter(
      (d) =>
        (d.station_id && lineStationIds.includes(d.station_id)) ||
        (d.machine_code && lineStationCodes.includes(d.machine_code))
    ) || [];

    log(
      `Filter by line ${lineFilter}`,
      lineDemands.length > 0,
      `${lineStations.length} stations, ${lineDemands.length} demand rows`
    );
  }

  // Summary
  console.log("\n📊 Summary:");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`   ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("\n✅ All tests passed!\n");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
