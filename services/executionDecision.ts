import { supabase } from "@/lib/supabaseClient";
import { getEmployeeCompetenceProfile } from "./competence";
import type { ShiftType } from "@/types/lineOverview";

let personEvents400Logged = false;

type PersonEventRow = { employee_id: string; title: string; due_date: string; status: string | null };

/** Fetch person_events by category with safe employee_id filter. On 400, log once and return []. */
async function fetchPersonEventsByCategory(
  employeeIds: string[],
  category: string,
  dueDateLte: string
): Promise<PersonEventRow[]> {
  // P0-1: Guard against empty arrays to prevent 400 errors from Supabase PostgREST
  if (!employeeIds || employeeIds.length === 0) {
    return [];
  }

  // P0-1: Filter out any invalid UUIDs to prevent type mismatch errors
  const validEmployeeIds = employeeIds.filter((id) => {
    // Basic UUID v4 format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return id && typeof id === "string" && uuidRegex.test(id);
  });

  if (validEmployeeIds.length === 0) {
    return [];
  }

  // P0-1: Fix - Use status column instead of completed_date (which doesn't exist in actual DB)
  // Filter for events that are not completed (status != 'completed')
  let query = supabase
    .from("person_events")
    .select("employee_id, title, due_date, status")
    .eq("category", category)
    .lte("due_date", dueDateLte)
    .neq("status", "completed");

  if (validEmployeeIds.length === 1) {
    query = query.eq("employee_id", validEmployeeIds[0]);
  } else {
    query = query.in("employee_id", validEmployeeIds);
  }

  const { data, error } = await query;

  if (error) {
    if (!personEvents400Logged) {
      personEvents400Logged = true;
      // eslint-disable-next-line no-console
      console.warn("[executionDecision] person_events fetch error (logged once):", (error as { message?: string }).message, (error as { details?: unknown }).details);
    }
    return [];
  }

  return (data ?? []) as PersonEventRow[];
}

export type BlockingReason = "competence" | "certification" | "medical" | "delegation";

export type ExecutionStatus = "GO" | "NO-GO";

export interface LineShiftDecision {
  lineCode: string;
  lineName: string;
  shiftType: ShiftType;
  status: ExecutionStatus;
  blockingReasons: {
    reason: BlockingReason;
    count: number;
    details: string[];
  }[];
}

export interface ExecutionDecisionData {
  date: string;
  decisions: LineShiftDecision[];
}

async function getEmployeesForLine(lineCode: string): Promise<Array<{ id: string; name: string; employeeCode?: string }>> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, employee_number")
    .eq("line", lineCode)
    .eq("is_active", true);

  if (error) {
    return [];
  }

  return (data || []).map((emp: any) => ({
    id: emp.id,
    name: emp.name,
    employeeCode: emp.employee_number,
  }));
}

async function checkCompetenceBlockers(employeeIds: string[]): Promise<Map<string, string[]>> {
  const blockers = new Map<string, string[]>();

  for (const empId of employeeIds) {
    try {
      const profile = await getEmployeeCompetenceProfile(empId);
      const gaps: string[] = [];

      for (const item of profile.items) {
        if (item.mandatory && item.status !== "OK") {
          const reason = item.riskReason || "Missing competence";
          gaps.push(`${item.competenceName}: ${reason}`);
        }
      }

      if (gaps.length > 0) {
        blockers.set(empId, gaps);
      }
    } catch {
      // skip: return empty blockers for this employee
    }
  }

  return blockers;
}

async function checkCertificationBlockers(employeeIds: string[]): Promise<Map<string, string[]>> {
  const blockers = new Map<string, string[]>();

  if (employeeIds.length === 0) return blockers;

  let compQuery = supabase
    .from("employee_competences")
    .select(`
      employee_id,
      valid_to,
      competences!inner(id, name, is_safety_critical)
    `)
    .eq("competences.is_safety_critical", true);

  if (employeeIds.length === 1) {
    compQuery = compQuery.eq("employee_id", employeeIds[0]);
  } else {
    compQuery = compQuery.in("employee_id", employeeIds);
  }

  const { data: compData, error: compError } = await compQuery;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!compError && compData) {
    for (const row of compData) {
      const empId = (row as any).employee_id;
      const competence = (row as any).competences;
      const validTo = (row as any).valid_to;

      if (!validTo) {
        const existing = blockers.get(empId) || [];
        blockers.set(empId, [...existing, `${competence.name}: Missing expiry date`]);
      } else {
        const expiryDate = new Date(validTo);
        expiryDate.setHours(0, 0, 0, 0);
        if (expiryDate < today) {
          const existing = blockers.get(empId) || [];
          blockers.set(empId, [...existing, `${competence.name}: Expired ${validTo}`]);
        }
      }
    }
  }

  const todayStr = today.toISOString().split("T")[0];
  const trainingEvents = await fetchPersonEventsByCategory(employeeIds, "training", todayStr);
  for (const event of trainingEvents) {
    const empId = event.employee_id;
    const existing = blockers.get(empId) || [];
    blockers.set(empId, [...existing, `${event.title}: Due ${event.due_date}`]);
  }

  return blockers;
}

async function checkMedicalBlockers(employeeIds: string[]): Promise<Map<string, string[]>> {
  const blockers = new Map<string, string[]>();

  if (employeeIds.length === 0) return blockers;

  const today = new Date().toISOString().split("T")[0];
  const events = await fetchPersonEventsByCategory(employeeIds, "medical_check", today);

  for (const event of events) {
    const empId = event.employee_id;
    const existing = blockers.get(empId) || [];
    blockers.set(empId, [...existing, `${event.title}: Due ${event.due_date}`]);
  }

  return blockers;
}

async function checkDelegationBlockers(employeeIds: string[]): Promise<Map<string, string[]>> {
  const blockers = new Map<string, string[]>();

  if (employeeIds.length === 0) return blockers;

  const today = new Date().toISOString().split("T")[0];
  const events = await fetchPersonEventsByCategory(employeeIds, "work_env_delegation", today);

  for (const event of events) {
    const empId = event.employee_id;
    const existing = blockers.get(empId) || [];
    blockers.set(empId, [...existing, `${event.title}: Due ${event.due_date}`]);
  }

  return blockers;
}

/**
 * Get execution decisions (GO/NO-GO) per line and shift.
 * @param date - plan date (YYYY-MM-DD)
 * @param shiftType - optional shift to limit to
 * @param orgId - active org (required); lines are taken from stations for this org
 * @param siteId - optional; if stations supported site_id, would filter (currently unused)
 */
export async function getExecutionDecisions(
  date: string,
  shiftType?: ShiftType,
  orgId?: string,
  _siteId?: string | null
): Promise<ExecutionDecisionData> {
  const shifts: ShiftType[] = shiftType ? [shiftType] : ["Day", "Evening", "Night"];

  if (!orgId) {
    return { date, decisions: [] };
  }

  const { data: stations, error: stationsError } = await supabase
    .from("stations")
    .select("line")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .not("line", "is", null);

  if (stationsError || !stations || stations.length === 0) {
    return { date, decisions: [] };
  }

  const uniqueLines = [...new Set((stations as Array<{ line?: string }>).map((s) => s.line).filter((v): v is string => Boolean(v)))].sort();
  const linesData = uniqueLines.map((lineCode) => ({ line_code: lineCode, line_name: lineCode }));

  const decisions: LineShiftDecision[] = [];

  for (const line of linesData || []) {
    for (const shift of shifts) {
      const employees = await getEmployeesForLine(line.line_code);

      if (employees.length === 0) {
        decisions.push({
          lineCode: line.line_code,
          lineName: line.line_name,
          shiftType: shift,
          status: "NO-GO",
          blockingReasons: [{
            reason: "competence",
            count: 0,
            details: ["No operators assigned"],
          }],
        });
        continue;
      }

      const employeeIds = employees.map((e) => e.id);

      const [
        competenceBlockers,
        certificationBlockers,
        medicalBlockers,
        delegationBlockers,
      ] = await Promise.all([
        checkCompetenceBlockers(employeeIds),
        checkCertificationBlockers(employeeIds),
        checkMedicalBlockers(employeeIds),
        checkDelegationBlockers(employeeIds),
      ]);

      const blockingReasons: LineShiftDecision["blockingReasons"] = [];

      if (competenceBlockers.size > 0) {
        const allDetails: string[] = [];
        for (const [empId, gaps] of competenceBlockers.entries()) {
          const emp = employees.find((e) => e.id === empId);
          const empName = emp?.name || empId;
          gaps.forEach((gap) => allDetails.push(`${empName}: ${gap}`));
        }
        blockingReasons.push({
          reason: "competence",
          count: competenceBlockers.size,
          details: allDetails,
        });
      }

      if (certificationBlockers.size > 0) {
        const allDetails: string[] = [];
        for (const [empId, certs] of certificationBlockers.entries()) {
          const emp = employees.find((e) => e.id === empId);
          const empName = emp?.name || empId;
          certs.forEach((cert) => allDetails.push(`${empName}: ${cert}`));
        }
        blockingReasons.push({
          reason: "certification",
          count: certificationBlockers.size,
          details: allDetails,
        });
      }

      if (medicalBlockers.size > 0) {
        const allDetails: string[] = [];
        for (const [empId, medicals] of medicalBlockers.entries()) {
          const emp = employees.find((e) => e.id === empId);
          const empName = emp?.name || empId;
          medicals.forEach((med) => allDetails.push(`${empName}: ${med}`));
        }
        blockingReasons.push({
          reason: "medical",
          count: medicalBlockers.size,
          details: allDetails,
        });
      }

      if (delegationBlockers.size > 0) {
        const allDetails: string[] = [];
        for (const [empId, delegs] of delegationBlockers.entries()) {
          const emp = employees.find((e) => e.id === empId);
          const empName = emp?.name || empId;
          delegs.forEach((deleg) => allDetails.push(`${empName}: ${deleg}`));
        }
        blockingReasons.push({
          reason: "delegation",
          count: delegationBlockers.size,
          details: allDetails,
        });
      }

      decisions.push({
        lineCode: line.line_code,
        lineName: line.line_name,
        shiftType: shift,
        status: blockingReasons.length > 0 ? "NO-GO" : "GO",
        blockingReasons,
      });
    }
  }

  return { date, decisions };
}
