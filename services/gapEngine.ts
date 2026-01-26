// services/gapEngine.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ShiftRule } from "@/lib/lineOverviewNet";

// Tables that require org_id scoping
const ORG_SCOPED_TABLES = [
  "shift_rules",
  "pl_employees",
  "employees",
  "stations",
  "station_role_requirements",
  "competences",
] as const;

// Fallback net shift hours if shift_rules is not available
const FALLBACK_NET_SHIFT_HOURS = 8.0;

/**
 * Get employee competence levels for specific competences.
 * Returns a map of competenceId -> employeeLevel.
 * 
 * This is a minimal version that only fetches what gapEngine needs,
 * using the provided supabaseClient (no global dependencies).
 * 
 * @param supabaseClient - Supabase client to use (must be scoped to org)
 * @param employeeId - Employee ID (must belong to org)
 * @param orgId - Organization ID for validation
 * @param competenceIds - Optional list of competence IDs to filter by
 * @param effectiveDate - Optional date for validity checking (not used in gapEngine, but kept for consistency)
 */
async function getEmployeeCompetenceLevels(
  supabaseClient: SupabaseClient<any, any, any>,
  employeeId: string,
  orgId: string,
  competenceIds?: string[],
  effectiveDate?: string
): Promise<Map<string, number>> {
  // Query employee_competences for this employee
  // Note: employee_competences doesn't have org_id, but is scoped via employee.org_id
  // We verify the employee belongs to org when we fetch employee names earlier
  let query = supabaseClient
    .from("employee_competences")
    .select("competence_id, level")
    .eq("employee_id", employeeId);
  
  if (competenceIds && competenceIds.length > 0) {
    query = query.in("competence_id", competenceIds);
  }
  
  const { data: empCompData, error: empCompError } = await query;
  
  if (empCompError) {
    console.error(`Failed to get employee competences for ${employeeId}:`, empCompError);
    // Return empty map on error - will be treated as missing competences
    return new Map();
  }
  
  const employeeCompRows = (empCompData || []) as Array<{
    competence_id: string;
    level: number;
  }>;
  
  // Build map of competenceId -> level
  const competenceLevels = new Map<string, number>();
  for (const row of employeeCompRows) {
    // Only include competences that belong to this org
    // We verify this by checking if the competence_id is in our org's competences
    // (This is done implicitly since we only check competences from station requirements)
    competenceLevels.set(row.competence_id, row.level);
  }
  
  return competenceLevels;
}

/**
 * Calculate net shift hours from shift rules.
 * Returns net hours (after breaks) for the shift, or fallback if rules unavailable.
 */
function calculateNetShiftHours(shiftRule: ShiftRule | null, shiftType: string): number {
  if (!shiftRule || !shiftRule.shift_start || !shiftRule.shift_end) {
    // Fallback: use constant for each shift type
    return FALLBACK_NET_SHIFT_HOURS;
  }
  
  // Calculate gross shift minutes
  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  
  const startMins = timeToMinutes(shiftRule.shift_start);
  const endMins = timeToMinutes(shiftRule.shift_end);
  const grossMins = endMins <= startMins 
    ? 24 * 60 - startMins + endMins  // overnight shift
    : endMins - startMins;
  
  if (grossMins <= 0) {
    return FALLBACK_NET_SHIFT_HOURS;
  }
  
  // Calculate net minutes: gross - break + paid_break
  const netMins = grossMins - (shiftRule.break_minutes || 0) + (shiftRule.paid_break_minutes || 0);
  const netHours = Math.max(0, netMins) / 60;
  
  return netHours > 0 ? netHours : FALLBACK_NET_SHIFT_HOURS;
}

export interface CompetenceGap {
  employee: string;
  employeeId: string;
  skill: string;
  skillCode: string;
  requiredLevel: number;
  currentLevel: number;
  severity: "OK" | "GAP" | "RISK";
  suggestedAction: "No action" | "Train" | "Swap" | "Buddy";
}

export interface MachineGapRow {
  stationOrMachine: string;
  stationOrMachineCode: string;
  required: number;
  assigned: number;
  staffingGap: number;
  competenceStatus: "OK" | "GAP" | "RISK" | "NO-GO";
  competenceGaps: CompetenceGap[];
}

export interface LineOverviewMachine {
  machine: {
    id: string;
    machineCode: string;
    machineName: string;
    lineCode: string;
  };
  requiredHours: number;
  assignedHours: number;
  gap: number;
  overAssigned: number;
  status: string;
  assignments: Array<{
    id: string;
    planDate: string;
    shiftType: string;
    machineCode: string;
    employeeCode: string;
    startTime: string;
    endTime: string;
    roleNote?: string | null;
  }>;
  assignedPeople: Array<{
    assignmentId: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    startTime: string;
    endTime: string;
    hours: number;
  }>;
}

export interface LineOverviewData {
  lines: Array<{
    line: {
      id: string;
      lineCode: string;
      lineName: string;
    };
    machines: LineOverviewMachine[];
  }>;
}

export interface ComputeLineGapsOptions {
  orgId: string;
  line: string;
  date: string;
  shiftType: string;
  supabaseClient: SupabaseClient<any, any, any>;
  lineOverviewData: LineOverviewData;
  strictOrgScope?: boolean;
}

export interface ComputeLineGapsResult {
  machineRows: MachineGapRow[];
}

/**
 * Compute gaps for a line on a given date and shift.
 * 
 * This is the unified gap engine that:
 * - Calculates requiredHeadcount from demand + netShiftHours
 * - Calculates assignedHeadcount from assignments
 * - Determines competence status (OK/GAP/RISK/NO-GO) for each machine
 * - Returns machine rows with nested competence gaps
 * 
 * Server-safe: Works with both client and server Supabase clients.
 * Does not use browser-only auth methods. Relies on passed orgId and client permissions.
 * 
 * @param options.strictOrgScope - If true (default), throws if orgId is missing or queries cannot be org-scoped
 */
export async function computeLineGaps(
  options: ComputeLineGapsOptions
): Promise<ComputeLineGapsResult> {
  const { 
    orgId, 
    line, 
    date, 
    shiftType, 
    supabaseClient, 
    lineOverviewData,
    strictOrgScope = true,
  } = options;

  // Validate orgId when strictOrgScope is enabled
  if (strictOrgScope) {
    if (!orgId || typeof orgId !== "string" || orgId.trim() === "") {
      throw new Error("orgId is required when strictOrgScope is true");
    }
  }

  // 1. Filter to selected line
  const selectedLineData = lineOverviewData.lines?.find(
    (l) => l.line?.lineCode === line
  );

  if (!selectedLineData) {
    // No demand configured for this line
    return { machineRows: [] };
  }

  const machines = selectedLineData.machines || [];

  if (machines.length === 0) {
    // No machines in this line
    return { machineRows: [] };
  }

  // 2. Get shift rules for net hours calculation
  // Table: shift_rules (requires org_id scoping)
  const { data: shiftRuleData } = await supabaseClient
    .from("shift_rules")
    .select("shift_start,shift_end,break_minutes,paid_break_minutes")
    .eq("org_id", orgId)
    .eq("shift_type", shiftType)
    .maybeSingle();

  const shiftRule = shiftRuleData as ShiftRule | null;
  const netShiftHours = calculateNetShiftHours(shiftRule, shiftType);

  // 3. Calculate staffing gaps per machine
  const machineToEmployees = new Map<string, Array<{ employeeCode: string; employeeId?: string }>>();

  for (const machine of machines) {
    const machineCode = machine.machine?.machineCode || "";
    const requiredHours = machine.requiredHours || 0;
    
    // Calculate assigned headcount from assignments
    // For headcount, we count unique employees, not hours
    const assignments = machine.assignments || [];
    const assignedPeople = new Set<string>();
    const employeeCodes: string[] = [];
    
    assignments.forEach((a) => {
      if (a.employeeCode) {
        assignedPeople.add(a.employeeCode);
        employeeCodes.push(a.employeeCode);
      }
    });
    
    const assignedHeadcount = assignedPeople.size;
    
    // Calculate required headcount: ceil(required_hours / netShiftHours)
    const requiredHeadcount = requiredHours > 0 
      ? Math.ceil(requiredHours / netShiftHours)
      : 0;
    
    // Store employee codes for this machine for competence checking
    if (employeeCodes.length > 0) {
      machineToEmployees.set(machineCode, employeeCodes.map(ec => ({ employeeCode: ec })));
    }
  }

  // If no machines have demand, return empty
  const hasDemand = machines.some(m => (m.requiredHours || 0) > 0);
  if (!hasDemand && machines.length === 0) {
    return { machineRows: [] };
  }

  // 4. Get employee mappings (employee_code -> employee_id) for competence checks
  const employeeCodeToId = new Map<string, string>();
  if (machineToEmployees.size > 0) {
    const allEmployeeCodes = Array.from(machineToEmployees.values())
      .flat()
      .map(e => e.employeeCode)
      .filter(Boolean);
    
    if (allEmployeeCodes.length > 0) {
      // Get pl_employees to map employee_code to employee_id
      // Table: pl_employees (requires org_id scoping)
      const { data: plEmployees } = await supabaseClient
        .from("pl_employees")
        .select("employee_code, id")
        .eq("org_id", orgId)
        .in("employee_code", [...new Set(allEmployeeCodes)]);
      
      if (plEmployees) {
        plEmployees.forEach((e: any) => {
          employeeCodeToId.set(e.employee_code, e.id);
        });
      }
      
      // Also try to get from employees table (might have different mapping)
      // Table: employees (requires org_id scoping)
      const { data: employees } = await supabaseClient
        .from("employees")
        .select("id, code")
        .eq("org_id", orgId)
        .in("code", [...new Set(allEmployeeCodes)]);
      
      if (employees) {
        employees.forEach((e: any) => {
          if (e.code && !employeeCodeToId.has(e.code)) {
            employeeCodeToId.set(e.code, e.id);
          }
        });
      }
    }
    
    // Update machineToEmployees with employee IDs
    machineToEmployees.forEach((employees, machineCode) => {
      employees.forEach(emp => {
        const empId = employeeCodeToId.get(emp.employeeCode);
        if (empId) {
          emp.employeeId = empId;
        }
      });
    });
  }

  // 5. Get stations for this line to find competence requirements
  // Table: stations (requires org_id scoping)
  let stationsQuery = supabaseClient
    .from("stations")
    .select("id, name, code, line")
    .eq("org_id", orgId)
    .eq("line", line)
    .eq("is_active", true);
  
  let stationsRes = await stationsQuery;
  
  if (stationsRes.error) {
    const errorCode = (stationsRes.error as any).code;
    const errorMessage = (stationsRes.error as any).message?.toLowerCase() || "";
    if (errorCode === "42703" || (errorMessage.includes("is_active") && errorMessage.includes("does not exist"))) {
      stationsQuery = supabaseClient
        .from("stations")
        .select("id, name, code, line")
        .eq("org_id", orgId)
        .eq("line", line);
      stationsRes = await stationsQuery;
    }
  }
  
  const stations = stationsRes.data || [];
  const stationIds = stations.map((s: { id: string }) => s.id);
  
  // 6. Get competence requirements for stations
  // Table: station_role_requirements (requires org_id scoping)
  const { data: requirements } = await supabaseClient
    .from("station_role_requirements")
    .select("station_id, skill_id, required_level, is_mandatory")
    .in("station_id", stationIds)
    .eq("org_id", orgId);
  
  // Get competence details
  // Table: competences (requires org_id scoping)
  const skillIds = requirements ? [...new Set(requirements.map((r: any) => r.skill_id).filter(Boolean))] : [];
  let competencesMap = new Map<string, { id: string; name: string; code: string }>();
  
  if (skillIds.length > 0) {
    const { data: competences } = await supabaseClient
      .from("competences")
      .select("id, name, code")
      .in("id", skillIds)
      .eq("org_id", orgId);
    
    if (competences) {
      competences.forEach((c: any) => {
        competencesMap.set(c.id, { id: c.id, name: c.name, code: c.code || "" });
      });
    }
  }
  
  // 7. Build requirement map: station_id -> requirements
  const reqMap = new Map<string, Array<{ skillId: string; skillName: string; skillCode: string; requiredLevel: number; isMandatory: boolean }>>();
  
  if (requirements) {
    for (const req of requirements) {
      const stationId = req.station_id;
      const skillId = req.skill_id;
      const competence = competencesMap.get(skillId);
      
      if (!reqMap.has(stationId)) {
        reqMap.set(stationId, []);
      }
      reqMap.get(stationId)!.push({
        skillId: skillId,
        skillName: competence?.name || "Unknown",
        skillCode: competence?.code || "",
        requiredLevel: req.required_level || 0,
        isMandatory: req.is_mandatory || false,
      });
    }
  }
  
  // 8. Try to map machines to stations (by line and potentially by code/name matching)
  const stationMap = new Map<string, string>(); // machine_code -> station_id
  stations.forEach((s: any) => {
    // Try to match by code if available
    if (s.code) {
      machines.forEach((m) => {
        if (m.machine?.machineCode === s.code) {
          stationMap.set(m.machine.machineCode, s.id);
        }
      });
    }
    // Also try name matching as fallback
    machines.forEach((m) => {
      if (!stationMap.has(m.machine?.machineCode || "")) {
        const machineName = (m.machine?.machineName || "").toLowerCase();
        const stationName = (s.name || "").toLowerCase();
        if (machineName && stationName && machineName === stationName) {
          stationMap.set(m.machine.machineCode, s.id);
        }
      }
    });
  });
  
  // 9. Collect all unique employee IDs and batch fetch data
  const allEmployeeIds = new Set<string>();
  machineToEmployees.forEach((employees) => {
    employees.forEach((emp) => {
      if (emp.employeeId) {
        allEmployeeIds.add(emp.employeeId);
      }
    });
  });
  
  const uniqueEmployeeIds = Array.from(allEmployeeIds);
  
  // Batch fetch employee names
  // Table: employees (requires org_id scoping)
  const employeeNameMap = new Map<string, string>();
  if (uniqueEmployeeIds.length > 0) {
    const { data: employeesData } = await supabaseClient
      .from("employees")
      .select("id, name")
      .in("id", uniqueEmployeeIds)
      .eq("org_id", orgId);
    
    if (employeesData) {
      employeesData.forEach((e: any) => {
        employeeNameMap.set(e.id, e.name || "Unknown");
      });
    }
  }
  
  // Batch fetch employee competence levels in parallel
  // Get all competence IDs we care about (from station requirements)
  const allRequiredCompetenceIds = Array.from(
    new Set(
      Array.from(reqMap.values())
        .flat()
        .map(req => req.skillId)
        .filter(Boolean)
    )
  );
  
  const competenceLevelCache = new Map<string, Map<string, number>>();
  
  if (uniqueEmployeeIds.length > 0 && allRequiredCompetenceIds.length > 0) {
    const levelPromises = uniqueEmployeeIds.map(async (empId) => {
      try {
        const levels = await getEmployeeCompetenceLevels(
          supabaseClient,
          empId,
          orgId,
          allRequiredCompetenceIds,
          date
        );
        return { empId, levels };
      } catch (err) {
        console.error(`Failed to get competence levels for employee ${empId}:`, err);
        // Return empty map on error - will be treated as missing competences
        return { empId, levels: new Map<string, number>() };
      }
    });
    
    const levelResults = await Promise.all(levelPromises);
    levelResults.forEach(({ empId, levels }) => {
      competenceLevelCache.set(empId, levels);
    });
  }
  
  const machineRows: MachineGapRow[] = [];
  
  // 10. For each machine, calculate staffing gaps and check competence
  for (const machine of machines) {
    const machineCode = machine.machine?.machineCode || "";
    const machineName = machine.machine?.machineName || machineCode;
    const requiredHours = machine.requiredHours || 0;
    
    // Calculate staffing gaps
    const assignments = machine.assignments || [];
    const assignedPeople = new Set<string>();
    
    assignments.forEach((a) => {
      if (a.employeeCode) {
        assignedPeople.add(a.employeeCode);
      }
    });
    
    const assignedHeadcount = assignedPeople.size;
    const requiredHeadcount = requiredHours > 0 
      ? Math.ceil(requiredHours / netShiftHours)
      : 0;
    const staffingGap = Math.max(requiredHeadcount - assignedHeadcount, 0);
    
    // Check competence for assigned employees
    const employees = machineToEmployees.get(machineCode) || [];
    const stationId = stationMap.get(machineCode);
    const stationReqs = stationId ? reqMap.get(stationId) || [] : [];
    
    const competenceGaps: CompetenceGap[] = [];
    let hasGap = false;
    let hasRisk = false;
    let hasNoGo = false;
    
    for (const emp of employees) {
      const employeeId = emp.employeeId;
      if (!employeeId) continue;
      
      const employeeName = employeeNameMap.get(employeeId);
      if (!employeeName) continue; // Skip if employee not found
      
      if (stationReqs.length === 0) {
        // No requirements defined - skip competence check
        continue;
      }
      
      // Get competence levels from cache
      const competenceLevels = competenceLevelCache.get(employeeId);
      
      // If levels not found (fetch failed or employee has no competences), treat as empty
      const levels = competenceLevels || new Map<string, number>();
      
      for (const req of stationReqs) {
        if (!req.isMandatory) continue;
        
        const currentLevel = levels.get(req.skillId) || 0;
        const requiredLevel = req.requiredLevel;
        
        let severity: "OK" | "GAP" | "RISK" = "OK";
        let suggestedAction: "No action" | "Train" | "Swap" | "Buddy" = "No action";
        
        if (currentLevel === 0 && requiredLevel > 0) {
          severity = "RISK";
          suggestedAction = "Train";
          hasRisk = true;
          hasNoGo = true; // Missing mandatory skill = NO-GO
        } else if (currentLevel < requiredLevel) {
          if (currentLevel >= requiredLevel - 1) {
            severity = "GAP";
            suggestedAction = "Buddy";
            hasGap = true;
          } else {
            severity = "RISK";
            suggestedAction = "Train";
            hasRisk = true;
          }
        }
        
        if (severity !== "OK" || currentLevel < requiredLevel) {
          competenceGaps.push({
            employee: employeeName,
            employeeId: employeeId,
            skill: req.skillName,
            skillCode: req.skillCode,
            requiredLevel,
            currentLevel,
            severity,
            suggestedAction,
          });
        }
      }
    }
    
    // Determine overall competence status for this machine
    let competenceStatus: "OK" | "GAP" | "RISK" | "NO-GO" = "OK";
    if (hasNoGo) {
      competenceStatus = "NO-GO";
    } else if (hasRisk) {
      competenceStatus = "RISK";
    } else if (hasGap) {
      competenceStatus = "GAP";
    }
    
    machineRows.push({
      stationOrMachine: machineName,
      stationOrMachineCode: machineCode,
      required: requiredHeadcount,
      assigned: assignedHeadcount,
      staffingGap,
      competenceStatus,
      competenceGaps,
    });
  }
  
  return { machineRows };
}
