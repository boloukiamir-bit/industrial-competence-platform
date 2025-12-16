import { supabase } from "@/lib/supabaseClient";
import type { GapItem } from "@/types/domain";

export async function calculateTomorrowsGaps(): Promise<GapItem[]> {
  const { data: requirements, error: reqError } = await supabase
    .from("role_skill_requirements")
    .select("id, role, line, skill_id, required_level, required_headcount");

  if (reqError) {
    console.error("Failed to fetch requirements:", reqError);
    return [];
  }

  if (!requirements || requirements.length === 0) {
    return [];
  }

  const skillIds = [...new Set(requirements.map((r) => r.skill_id))];
  const { data: skills } = await supabase
    .from("skills")
    .select("id, name")
    .in("id", skillIds);

  const skillMap = new Map<string, string>();
  for (const skill of skills || []) {
    skillMap.set(skill.id, skill.name);
  }

  const gaps: GapItem[] = [];

  for (const req of requirements) {
    const { role, line, skill_id, required_level, required_headcount } = req;

    const { data: employees } = await supabase
      .from("employees")
      .select("id")
      .eq("role", role)
      .eq("line", line)
      .eq("is_active", true);

    const employeeIds = (employees || []).map((e) => e.id);

    if (employeeIds.length === 0) {
      gaps.push({
        line,
        team: null,
        role,
        skillName: skillMap.get(skill_id) || "Unknown",
        skillId: skill_id,
        requiredLevel: required_level,
        currentAvgLevel: 0,
        missingCount: required_headcount,
      });
      continue;
    }

    const { data: empSkills } = await supabase
      .from("employee_skills")
      .select("employee_id, level")
      .eq("skill_id", skill_id)
      .in("employee_id", employeeIds);

    const qualifiedCount = (empSkills || []).filter(
      (es) => es.level >= required_level
    ).length;

    const avgLevel =
      empSkills && empSkills.length > 0
        ? empSkills.reduce((sum, es) => sum + es.level, 0) / empSkills.length
        : 0;

    const missingCount = Math.max(0, required_headcount - qualifiedCount);

    if (missingCount > 0) {
      gaps.push({
        line,
        team: null,
        role,
        skillName: skillMap.get(skill_id) || "Unknown",
        skillId: skill_id,
        requiredLevel: required_level,
        currentAvgLevel: Math.round(avgLevel * 10) / 10,
        missingCount,
      });
    }
  }

  return gaps;
}

interface RawGapData {
  line_name: string;
  role_name: string;
  skill_name: string;
  missing: number;
}

export function getCriticalGaps(gaps: RawGapData[]) {
  return gaps
    .filter((g) => g.missing > 0)
    .map((g) => ({
      line: g.line_name,
      role: g.role_name,
      skill: g.skill_name,
      missingCount: g.missing,
    }));
}

export function getCriticalGapsFromItems(gaps: GapItem[]) {
  return gaps
    .filter((g) => g.missingCount > 0)
    .map((g) => ({
      line: g.line,
      role: g.role,
      skill: g.skillName,
      missingCount: g.missingCount,
    }));
}

interface SkillStats {
  level_0: number;
  level_1: number;
  level_2?: number;
  level_3: number;
  level_4: number;
}

export function getTrainingPriorities(skillsStats: Record<string, SkillStats>) {
  return Object.entries(skillsStats)
    .map(([skill, stats]) => ({
      skill,
      countLevel0or1: stats.level_0 + stats.level_1,
    }))
    .filter((i) => i.countLevel0or1 > 0)
    .sort((a, b) => b.countLevel0or1 - a.countLevel0or1);
}

export function getOverstaffedSkills(skillsStats: Record<string, SkillStats>) {
  return Object.entries(skillsStats)
    .map(([skill, stats]) => ({
      skill,
      countLevel3or4: stats.level_3 + stats.level_4,
    }))
    .filter((i) => i.countLevel3or4 >= 3)
    .sort((a, b) => b.countLevel3or4 - a.countLevel3or4);
}

export async function getSkillStats(): Promise<Record<string, SkillStats>> {
  const { data: skills } = await supabase.from("skills").select("id, name");
  const { data: empSkills } = await supabase
    .from("employee_skills")
    .select("skill_id, level");

  const stats: Record<string, SkillStats> = {};

  for (const skill of skills || []) {
    stats[skill.name] = {
      level_0: 0,
      level_1: 0,
      level_2: 0,
      level_3: 0,
      level_4: 0,
    };
  }

  for (const es of empSkills || []) {
    const skill = skills?.find((s) => s.id === es.skill_id);
    if (skill && stats[skill.name]) {
      const key = `level_${es.level}` as keyof SkillStats;
      if (key in stats[skill.name]) {
        (stats[skill.name][key] as number)++;
      }
    }
  }

  return stats;
}

// ============================================================
// Position-based Tomorrow's Gaps v1
// ============================================================

import { getEmployeesForPosition, getEmployeeCompetenceProfile } from "./competence";

export type PositionGapRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PositionGapSummary = {
  positionId: string;
  positionName: string;
  site: string | null;
  department: string | null;
  minHeadcount: number;
  totalEmployees: number;
  fullyCompetentCount: number;
  gapCount: number;
  coveragePercent: number;
  riskLevel: PositionGapRisk;
  riskReason: string | null;
};

export type TomorrowsGapsOverview = {
  positions: PositionGapSummary[];
  summary: {
    totalPositions: number;
    criticalPositions: number;
    highRiskPositions: number;
    mediumRiskPositions: number;
    lowRiskPositions: number;
    totalGapHeadcount: number;
  };
};

type PositionRow = {
  id: string;
  name: string;
  site: string | null;
  department: string | null;
  min_headcount: number | null;
};

export async function getTomorrowsGaps(): Promise<TomorrowsGapsOverview> {
  const { data: posData, error: posError } = await supabase
    .from("positions")
    .select("id, name, site, department, min_headcount")
    .order("name", { ascending: true });

  if (posError) throw posError;

  const positions = (posData ?? []) as PositionRow[];
  const positionGaps: PositionGapSummary[] = [];

  let criticalPositions = 0;
  let highRiskPositions = 0;
  let mediumRiskPositions = 0;
  let lowRiskPositions = 0;
  let totalGapHeadcount = 0;

  for (const pos of positions) {
    const minHeadcount = pos.min_headcount ?? 0;
    
    const employees = await getEmployeesForPosition(pos.id);
    const totalEmployees = employees.length;
    
    let fullyCompetentCount = 0;
    
    for (const emp of employees) {
      try {
        const profile = await getEmployeeCompetenceProfile(emp.id);
        if (profile.summary.gapCount === 0 && profile.summary.coveragePercent === 100) {
          fullyCompetentCount++;
        }
      } catch (err) {
        console.error(`Failed to get profile for employee ${emp.id}:`, err);
      }
    }

    const gapCount = Math.max(0, minHeadcount - fullyCompetentCount);
    const coveragePercent = minHeadcount === 0 
      ? 100 
      : Math.round((fullyCompetentCount / minHeadcount) * 100);

    let riskLevel: PositionGapRisk;
    let riskReason: string | null = null;

    if (minHeadcount === 0) {
      riskLevel = "LOW";
      riskReason = "No minimum headcount defined";
    } else if (fullyCompetentCount >= minHeadcount) {
      riskLevel = "LOW";
    } else if (fullyCompetentCount === 0) {
      riskLevel = "CRITICAL";
      riskReason = `No fully competent employees (need ${minHeadcount})`;
    } else if (coveragePercent < 50) {
      riskLevel = "HIGH";
      riskReason = `Only ${fullyCompetentCount}/${minHeadcount} positions covered`;
    } else {
      riskLevel = "MEDIUM";
      riskReason = `${gapCount} position(s) uncovered`;
    }

    switch (riskLevel) {
      case "CRITICAL":
        criticalPositions++;
        break;
      case "HIGH":
        highRiskPositions++;
        break;
      case "MEDIUM":
        mediumRiskPositions++;
        break;
      case "LOW":
        lowRiskPositions++;
        break;
    }

    totalGapHeadcount += gapCount;

    positionGaps.push({
      positionId: pos.id,
      positionName: pos.name,
      site: pos.site,
      department: pos.department,
      minHeadcount,
      totalEmployees,
      fullyCompetentCount,
      gapCount,
      coveragePercent,
      riskLevel,
      riskReason,
    });
  }

  positionGaps.sort((a, b) => {
    const riskOrder: Record<PositionGapRisk, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
  });

  return {
    positions: positionGaps,
    summary: {
      totalPositions: positions.length,
      criticalPositions,
      highRiskPositions,
      mediumRiskPositions,
      lowRiskPositions,
      totalGapHeadcount,
    },
  };
}
