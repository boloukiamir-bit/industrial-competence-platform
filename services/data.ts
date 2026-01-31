"use client";

import { supabase } from "@/lib/supabaseClient";
import {
  isDemoMode,
  getDemoOrg,
  getDemoSkills,
  getDemoPositions,
  getDemoOrgUnits,
  getDemoRequirements,
  getDemoEmployeeSkills,
  getDemoGaps,
  getDemoMetrics,
} from "@/lib/demoRuntime";
import type { Employee, Skill, OrgUnit, GapItem } from "@/types/domain";

export async function getOrg(orgId?: string) {
  if (!orgId) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error) {
    console.error("Error fetching org:", error);
    return null;
  }

  return data;
}

export async function getEmployees(orgId?: string): Promise<Employee[]> {
  if (!orgId) return [];
  let query = supabase
    .from("employees")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("is_active", true)
    .order("name");

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name || "",
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    email: row.email || undefined,
    employeeNumber: row.employee_number || "",
    role: row.role || "",
    line: row.line || "",
    team: row.team || "",
    employmentType: row.employment_type || "permanent",
    startDate: row.start_date || undefined,
    isActive: row.is_active ?? true,
  }));
}

export async function getSkills(orgId?: string): Promise<Skill[]> {
  if (isDemoMode()) {
    return getDemoSkills();
  }

  let query = supabase.from("competences").select("*").eq("active", true).order("name");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching skills:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    category: row.group_id || "General",
    description: row.description || undefined,
  }));
}

export async function getPositions(orgId?: string) {
  if (isDemoMode()) {
    return getDemoPositions();
  }

  let query = supabase.from("positions").select("*").order("name");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching positions:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name || "",
    line: row.line || "",
    minHeadcount: row.min_headcount || 1,
  }));
}

export async function getOrgUnits(orgId?: string): Promise<OrgUnit[]> {
  if (isDemoMode()) {
    return getDemoOrgUnits();
  }

  let query = supabase.from("org_units").select("*").order("name");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching org units:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    parentId: row.parent_id || undefined,
    type: row.type || undefined,
    createdAt: row.created_at,
    employeeCount: 0,
  }));
}

export async function getRequirements(orgId?: string) {
  if (isDemoMode()) {
    return getDemoRequirements();
  }

  let query = supabase.from("position_requirements").select("*");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching requirements:", error);
    return [];
  }

  return (data || []).map((row) => ({
    positionId: row.position_id,
    positionName: "",
    skillId: row.competence_id,
    skillName: "",
    requiredLevel: row.required_level || 1,
  }));
}

export async function getEmployeeSkills(orgId?: string) {
  if (isDemoMode()) {
    return getDemoEmployeeSkills();
  }

  let query = supabase.from("employee_competences").select("*");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching employee skills:", error);
    return [];
  }

  return (data || []).map((row) => ({
    employeeId: row.employee_id,
    skillId: row.competence_id,
    level: row.level || 0,
    skillName: "",
    skillCode: "",
  }));
}

export async function getGaps(orgId?: string): Promise<GapItem[]> {
  if (isDemoMode()) {
    return getDemoGaps();
  }

  const [employees, requirements, employeeSkills, positions] = await Promise.all([
    getEmployees(orgId),
    getRequirements(orgId),
    getEmployeeSkills(orgId),
    getPositions(orgId),
  ]);

  const gaps: GapItem[] = [];

  for (const req of requirements) {
    const position = positions.find((p) => p.id === req.positionId);
    if (!position) continue;

    const employeesInLine = employees.filter((e) => e.line === position.line && e.isActive);

    let totalLevel = 0;
    let missingCount = 0;

    for (const emp of employeesInLine) {
      const skill = employeeSkills.find(
        (es) => es.employeeId === emp.id && es.skillId === req.skillId
      );
      const level = skill?.level || 0;
      totalLevel += level;
      if (level < req.requiredLevel) {
        missingCount++;
      }
    }

    const avgLevel = employeesInLine.length > 0 ? totalLevel / employeesInLine.length : 0;

    if (missingCount > 0) {
      gaps.push({
        line: position.line,
        team: null,
        role: position.name,
        skillName: req.skillName || req.skillId,
        skillId: req.skillId,
        requiredLevel: req.requiredLevel,
        currentAvgLevel: Math.round(avgLevel * 10) / 10,
        missingCount,
      });
    }
  }

  return gaps.sort((a, b) => b.missingCount - a.missingCount);
}

export async function getMetrics(orgId?: string) {
  if (isDemoMode()) {
    return getDemoMetrics();
  }

  const [employees, gaps, positions, skills, orgUnits] = await Promise.all([
    getEmployees(orgId),
    getGaps(orgId),
    getPositions(orgId),
    getSkills(orgId),
    getOrgUnits(orgId),
  ]);

  const activeEmployees = employees.filter((e) => e.isActive);
  const atRiskCount = gaps.reduce((acc, g) => acc + g.missingCount, 0);
  const topGapSkill = gaps[0]?.skillName || "None";

  return {
    totalEmployees: activeEmployees.length,
    atRiskCount,
    topGapSkill,
    avgReadiness: 75,
    totalPositions: positions.length,
    totalSkills: skills.length,
    totalOrgUnits: orgUnits.length,
    gapCount: gaps.length,
  };
}

export async function getAuditLogs(orgId?: string) {
  if (isDemoMode()) {
    return [
      { id: "1", action: "org_created", user_email: "admin@nadiplan.test", created_at: new Date().toISOString(), details: { org_name: "Demo Manufacturing" } },
      { id: "2", action: "employee_added", user_email: "admin@nadiplan.test", created_at: new Date(Date.now() - 3600000).toISOString(), details: { employee_name: "Anna Lindberg" } },
      { id: "3", action: "competence_updated", user_email: "admin@nadiplan.test", created_at: new Date(Date.now() - 7200000).toISOString(), details: { competence_name: "Safety Basic" } },
    ];
  }

  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data || [];
}

export async function getUsers(orgId?: string) {
  if (isDemoMode()) {
    return [
      { id: "1", email: "admin@nadiplan.test", role: "admin", is_active: true, created_at: "2024-01-01T00:00:00Z" },
      { id: "2", email: "hr@nadiplan.test", role: "hr", is_active: true, created_at: "2024-01-15T00:00:00Z" },
      { id: "3", email: "manager@nadiplan.test", role: "manager", is_active: true, created_at: "2024-02-01T00:00:00Z" },
    ];
  }

  let query = supabase.from("memberships").select("*").order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return data || [];
}
