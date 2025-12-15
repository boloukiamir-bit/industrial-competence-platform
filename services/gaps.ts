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
