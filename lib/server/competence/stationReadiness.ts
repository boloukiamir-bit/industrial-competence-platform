/**
 * Deterministic station and shift ops readiness for Competence Matrix v2.
 * Roster-scoped: only roster employees are considered for eligibility.
 * Data sources: stations, station_skill_requirements (MANDATORY), employee_skills (level).
 */

export type OpsStatus = "OPS_GO" | "OPS_WARNING" | "OPS_NO_GO";

export type RequirementSpec = {
  skill_id: string;
  skill_code: string;
  required_level: number;
};

/** Per-station mandatory requirements (deduplicated by skill; max required_level per skill). */
export function buildStationRequirements(
  rows: Array<{ station_id: string; skill_id: string; required_level: number }>,
  skillCodeById: Map<string, string>
): Map<string, RequirementSpec[]> {
  const byStation = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.station_id || !r.skill_id) continue;
    const level = typeof r.required_level === "number" ? r.required_level : 1;
    let skillLevels = byStation.get(r.station_id);
    if (!skillLevels) {
      skillLevels = new Map<string, number>();
      byStation.set(r.station_id, skillLevels);
    }
    const current = skillLevels.get(r.skill_id);
    if (current === undefined || level > current) skillLevels.set(r.skill_id, level);
  }
  const out = new Map<string, RequirementSpec[]>();
  for (const [stationId, skillLevels] of byStation) {
    out.set(
      stationId,
      Array.from(skillLevels.entries()).map(([skill_id, required_level]) => ({
        skill_id,
        skill_code: skillCodeById.get(skill_id) ?? skill_id,
        required_level,
      }))
    );
  }
  return out;
}

/** Employee skill levels: employee_id -> skill_id -> level (max level if multiple rows). */
export function buildEmployeeLevels(
  rows: Array<{ employee_id: string; skill_id: string; level: number | null }>
): Map<string, Map<string, number>> {
  const byEmployee = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.employee_id || !r.skill_id) continue;
    const level = typeof r.level === "number" ? r.level : 0;
    let skills = byEmployee.get(r.employee_id);
    if (!skills) {
      skills = new Map<string, number>();
      byEmployee.set(r.employee_id, skills);
    }
    const existing = skills.get(r.skill_id);
    if (existing === undefined || level > existing) skills.set(r.skill_id, level);
  }
  return byEmployee;
}

export type GapReason = {
  type: "MISSING_SKILL";
  skill_code: string;
  required_level: number;
  eligible_count: number;
};

export type StationReadiness = {
  station_id: string;
  station_code: string;
  station_name: string;
  line: string | null;
  status: OpsStatus;
  required_skills_count: number;
  eligible_employees_count: number;
  gap_reasons: GapReason[];
};

/**
 * Compute readiness for one station: roster employees only; eligibility = all mandatory skills >= required_level.
 * OPS_NO_GO if zero eligible; else OPS_GO (criticality-based OPS_WARNING skipped when no criticality field).
 */
export function computeStationReadiness(
  stationId: string,
  stationCode: string,
  stationName: string,
  line: string | null,
  requirements: RequirementSpec[],
  rosterEmployeeIds: string[],
  employeeLevels: Map<string, Map<string, number>>
): StationReadiness {
  const required_skills_count = requirements.length;

  if (requirements.length === 0) {
    const eligible = rosterEmployeeIds.length;
    const status: OpsStatus = eligible === 0 ? "OPS_NO_GO" : "OPS_GO";
    return {
      station_id: stationId,
      station_code: stationCode,
      station_name: stationName,
      line,
      status,
      required_skills_count: 0,
      eligible_employees_count: eligible,
      gap_reasons: [],
    };
  }

  const eligibleIds: string[] = [];
  for (const empId of rosterEmployeeIds) {
    const levels = employeeLevels.get(empId);
    let passes = true;
    for (const req of requirements) {
      const level = levels?.get(req.skill_id);
      if (typeof level !== "number" || level < req.required_level) {
        passes = false;
        break;
      }
    }
    if (passes) eligibleIds.push(empId);
  }

  const gap_reasons: GapReason[] = [];
  for (const req of requirements) {
    let eligible_count = 0;
    for (const empId of rosterEmployeeIds) {
      const level = employeeLevels.get(empId)?.get(req.skill_id);
      if (typeof level === "number" && level >= req.required_level) eligible_count += 1;
    }
    if (eligible_count === 0) {
      gap_reasons.push({
        type: "MISSING_SKILL",
        skill_code: req.skill_code,
        required_level: req.required_level,
        eligible_count: 0,
      });
    }
  }

  const status: OpsStatus =
    eligibleIds.length === 0 ? "OPS_NO_GO" : "OPS_GO";

  return {
    station_id: stationId,
    station_code: stationCode,
    station_name: stationName,
    line,
    status,
    required_skills_count,
    eligible_employees_count: eligibleIds.length,
    gap_reasons,
  };
}

/**
 * Aggregate station statuses into shift ops readiness.
 * OPS_NO_GO if any station OPS_NO_GO; OPS_WARNING if any OPS_WARNING; else OPS_GO.
 */
export function shiftOpsReadinessFromStations(stationStatuses: OpsStatus[]): OpsStatus {
  if (stationStatuses.some((s) => s === "OPS_NO_GO")) return "OPS_NO_GO";
  if (stationStatuses.some((s) => s === "OPS_WARNING")) return "OPS_WARNING";
  return "OPS_GO";
}
