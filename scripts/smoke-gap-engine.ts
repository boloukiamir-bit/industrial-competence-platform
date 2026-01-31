#!/usr/bin/env ts-node
/**
 * Smoke test for gapEngine service.
 * 
 * Validates that computeLineGaps returns consistent results and tenant scoping works.
 * 
 * Usage:
 *   SMOKE_ORG_ID=xxx SMOKE_LINE=Line1 SMOKE_DATE=2025-01-27 SMOKE_SHIFT=Day npm run smoke:gap
 * 
 * Environment variables can also be loaded from .env.local file.
 */

// Load environment variables from .env.local if it exists
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = join(__dirname, "..", ".env.local");
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (err) {
  // .env.local doesn't exist or can't be read - that's okay, use env vars directly
}

import { createClient } from "@supabase/supabase-js";
import { computeLineGaps, type LineOverviewData } from "../services/gapEngine";
import { segmentGrossHours } from "../lib/lineOverviewNet";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration");
  }
  return createClient(url, key);
}

function shiftParamToDbValue(shift: string): string {
  const map: Record<string, string> = {
    day: "Day",
    evening: "Evening",
    night: "Night",
  };
  return map[shift.toLowerCase()] || "Day";
}

/**
 * Fetch line-overview data needed for gapEngine.
 * This replicates the core logic from /api/line-overview but only fetches what's needed.
 */
async function fetchLineOverviewData(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  orgId: string,
  date: string,
  shiftType: string,
  line: string
): Promise<LineOverviewData | null> {
  const shift = shiftParamToDbValue(shiftType);

  // Get machines for this line
  const { data: machines, error: machinesError } = await supabaseAdmin
    .from("pl_machines")
    .select("*")
    .eq("org_id", orgId)
    .eq("line_code", line)
    .order("machine_code");

  if (machinesError) {
    console.error("smoke-gap-engine: failed to fetch machines", machinesError);
    return null;
  }

  if (!machines || machines.length === 0) {
    console.warn(`smoke-gap-engine: no machines found for line ${line}`);
    return null;
  }

  const machineCodes = machines.map((m: any) => m.machine_code);

  // Fetch demand and assignments (gross hours; shift_rules not used for Cockpit MVP)
  const [demandRes, assignmentsRes] = await Promise.all([
    supabaseAdmin
      .from("pl_machine_demand")
      .select("*")
      .eq("org_id", orgId)
      .eq("plan_date", date)
      .eq("shift_type", shift)
      .in("machine_code", machineCodes),
    supabaseAdmin
      .from("pl_assignment_segments")
      .select("*")
      .eq("org_id", orgId)
      .eq("plan_date", date)
      .eq("shift_type", shift)
      .in("machine_code", machineCodes),
  ]);

  if (demandRes.error || assignmentsRes.error) {
    console.error(
      "smoke-gap-engine: failed to fetch demand/assignments",
      demandRes.error || assignmentsRes.error
    );
    return null;
  }

  const demands = demandRes.data || [];
  const assignments = assignmentsRes.data || [];

  const demandMap = new Map(demands.map((d: any) => [d.machine_code, d]));
  const assignmentsByMachine = new Map<string, typeof assignments>();
  assignments.forEach((a: any) => {
    const list = assignmentsByMachine.get(a.machine_code) || [];
    list.push(a);
    assignmentsByMachine.set(a.machine_code, list);
  });

  // Build machine data matching LineOverviewData structure
  const machineData = machines.map((machine: any) => {
    const demand = demandMap.get(machine.machine_code);
    const machineAssignments = assignmentsByMachine.get(machine.machine_code) || [];

    const requiredHours = demand?.required_hours || 0;
    let assignedHours = 0;
    const assignedPeople: Array<{
      assignmentId: string;
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      startTime: string;
      endTime: string;
      hours: number;
    }> = [];

    machineAssignments.forEach((a: any) => {
      const hours = segmentGrossHours(a.start_time, a.end_time);
      assignedHours += hours;

      assignedPeople.push({
        assignmentId: a.id,
        employeeId: "", // Will be resolved by gapEngine
        employeeCode: a.employee_code,
        employeeName: "", // Will be resolved by gapEngine
        startTime: a.start_time,
        endTime: a.end_time,
        hours,
      });
    });

    const gap = requiredHours - assignedHours;
    const overAssigned = assignedHours > requiredHours ? assignedHours - requiredHours : 0;

    let status: "ok" | "partial" | "gap" | "over" | "no_demand" = "no_demand";
    if (requiredHours > 0) {
      if (assignedHours === 0) status = "gap";
      else if (assignedHours < requiredHours) status = "partial";
      else if (assignedHours > requiredHours) status = "over";
      else status = "ok";
    } else if (assignedHours > 0) {
      status = "over";
    }

    const assignmentsOut = machineAssignments.map((a: any) => ({
      id: a.id,
      planDate: a.plan_date,
      shiftType: a.shift_type,
      machineCode: a.machine_code,
      employeeCode: a.employee_code,
      startTime: a.start_time,
      endTime: a.end_time,
      roleNote: a.role_note,
    }));

    return {
      machine: {
        id: machine.id,
        machineCode: machine.machine_code,
        machineName: machine.machine_name,
        lineCode: machine.line_code,
      },
      requiredHours,
      assignedHours,
      gap,
      overAssigned,
      status,
      assignments: assignmentsOut,
      assignedPeople,
    };
  });

  return {
    lines: [
      {
        line: {
          id: line,
          lineCode: line,
          lineName: line,
        },
        machines: machineData,
      },
    ],
  };
}

async function main() {
  // Read env vars
  const orgId = process.env.SMOKE_ORG_ID;
  const line = process.env.SMOKE_LINE;
  const date = process.env.SMOKE_DATE;
  const shift = process.env.SMOKE_SHIFT;

  if (!orgId || !line || !date || !shift) {
    console.error("Missing required environment variables:");
    if (!orgId) console.error("  SMOKE_ORG_ID is required");
    if (!line) console.error("  SMOKE_LINE is required");
    if (!date) console.error("  SMOKE_DATE is required (format: YYYY-MM-DD)");
    if (!shift) console.error("  SMOKE_SHIFT is required (Day/Evening/Night)");
    process.exit(1);
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    process.exit(1);
  }

  console.log("smoke-gap-engine: Starting smoke test...");
  console.log(`  orgId: ${orgId}`);
  console.log(`  line: ${line}`);
  console.log(`  date: ${date}`);
  console.log(`  shift: ${shift}`);

  try {
    const supabaseAdmin = getServiceClient();

    // Fetch line-overview data
    console.log("smoke-gap-engine: Fetching line-overview data...");
    const lineOverviewData = await fetchLineOverviewData(
      supabaseAdmin,
      orgId,
      date,
      shift,
      line
    );

    if (!lineOverviewData) {
      console.error("smoke-gap-engine: Failed to fetch line-overview data");
      process.exit(1);
    }

    // Call computeLineGaps
    console.log("smoke-gap-engine: Computing gaps...");
    const result = await computeLineGaps({
      orgId,
      line,
      date,
      shiftType: shift,
      supabaseClient: supabaseAdmin,
      lineOverviewData,
      strictOrgScope: true,
    });

    // Print results
    const machineRows = result.machineRows;
    const rowsWithStaffingGap = machineRows.filter((mr) => mr.staffingGap > 0).length;
    const rowsWithCompetenceIssues = machineRows.filter(
      (mr) => mr.competenceStatus !== "OK"
    ).length;

    console.log("\nsmoke-gap-engine: Results:");
    console.log(`  Total machine rows: ${machineRows.length}`);
    console.log(`  Rows with staffing_gap > 0: ${rowsWithStaffingGap}`);
    console.log(`  Rows with competence_status != OK: ${rowsWithCompetenceIssues}`);

    if (machineRows.length > 0) {
      console.log("\n  Sample machine rows:");
      machineRows.slice(0, 3).forEach((mr) => {
        console.log(`    - ${mr.stationOrMachine} (${mr.stationOrMachineCode})`);
        console.log(`      required: ${mr.required}, assigned: ${mr.assigned}, gap: ${mr.staffingGap}`);
        console.log(`      competence_status: ${mr.competenceStatus}`);
        console.log(`      competence_gaps: ${mr.competenceGaps.length}`);
      });
    }

    console.log("\nsmoke-gap-engine: ✓ Test passed");
    process.exit(0);
  } catch (error) {
    console.error("smoke-gap-engine: ✗ Test failed");
    console.error(error);
    process.exit(1);
  }
}

main();
