// services/competence.ts
import { supabase } from "@/lib/supabaseClient";

export type EmployeeCompetenceItem = {
  competenceId: string;
  competenceName: string;
  competenceCode: string | null;
  groupName: string | null;
  requiredLevel: number | null;
  mandatory: boolean;
  employeeLevel: number | null;
  validTo: string | null;
  status: "OK" | "GAP" | "RISK" | "N/A";
  riskReason: string | null;
  isSafetyCritical: boolean;
};

export type EmployeeCompetenceSummary = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  gapCount: number;
  totalRequired: number;
  coveragePercent: number; // 0–100
  expiredCount: number;
};

export type EmployeeCompetenceProfile = {
  employee: {
    id: string;
    name: string;
    positionName: string | null;
  };
  summary: EmployeeCompetenceSummary;
  items: EmployeeCompetenceItem[];
};

export type PositionSummary = {
  id: string;
  name: string;
  site: string | null;
  department: string | null;
};

export type SimpleEmployee = {
  id: string;
  name: string;
};

export type MatrixColumn = {
  competenceId: string;
  label: string;
  groupName: string | null;
  requiredLevel: number | null;
};

export type MatrixCellStatus = 'OK' | 'GAP' | 'RISK' | 'N/A';

export type MatrixRow = {
  employeeId: string;
  employeeName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  items: {
    competenceId: string;
    status: MatrixCellStatus;
    level: number | null;
    requiredLevel?: number | null;
  }[];
};

export async function getAllPositions(): Promise<PositionSummary[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('id, name, site, department')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PositionSummary[];
}

export async function getEmployeesForPosition(positionId: string, orgId?: string): Promise<SimpleEmployee[]> {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from('employees')
    .select('id, name')
    .eq('position_id', positionId)
    .eq('org_id', orgId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name ?? 'Employee',
  }));
}

type EmployeeRow = {
  id: string;
  name?: string | null;
  position_id?: string | null;
};

type RequirementRow = {
  id: string;
  position_id: string;
  competence_id: string;
  required_level: number;
  mandatory: boolean;
};

type EmployeeCompetenceRow = {
  id: string;
  employee_id: string;
  competence_id: string;
  level: number;
  valid_from: string | null;
  valid_to: string | null;
};

type CompetenceRow = {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  group_id?: string | null;
  is_safety_critical: boolean;
};

type GroupRow = {
  id: string;
  name: string;
};

export async function getEmployeeCompetenceProfile(
  employeeId: string,
  effectiveDate?: string,
  orgId?: string
): Promise<EmployeeCompetenceProfile> {
  // Validate employeeId
  if (!employeeId || employeeId.trim() === "") {
    throw new Error("employeeId is required");
  }

  // Resolve effectiveOrgId
  let effectiveOrgId: string;
  if (orgId) {
    effectiveOrgId = orgId;
  } else {
    // Fetch current user and profile
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Failed to get current user");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.active_org_id) {
      throw new Error("Missing active_org_id");
    }

    effectiveOrgId = profile.active_org_id;
  }

  // Use provided date or default to today
  const effectiveDateStr =
    effectiveDate ?? new Date().toISOString().slice(0, 10);

  // 1) Employee - ensure employee belongs to org
  const { data: employeeRow, error: empError } = await supabase
    .from("employees")
    .select("id, name, position_id")
    .eq("id", employeeId)
    .eq("org_id", effectiveOrgId)
    .single<EmployeeRow>();

  if (empError || !employeeRow) {
    console.error(empError);
    throw empError ?? new Error("Employee not found");
  }

  const employeeName = employeeRow.name ?? "Employee";

  // 2) Position (optional)
  let positionName: string | null = null;
  const positionId = employeeRow.position_id ?? null;

  if (positionId) {
    const { data: posRows } = await supabase
      .from("positions")
      .select("id, name")
      .eq("id", positionId)
      .eq("org_id", effectiveOrgId)
      .limit(1);

    const pos = posRows?.[0] as { id: string; name: string } | undefined;
    if (pos) {
      positionName = pos.name;
    }
  }

  // 3) Requirements for this position
  let requirementRows: RequirementRow[] = [];
  if (positionId) {
    // Filter requirements by position_id (position already verified to belong to org above)
    // Note: position_competence_requirements doesn't have org_id, but is scoped via position.org_id
    const { data: reqData, error: reqError } = await supabase
      .from("position_competence_requirements")
      .select("id, position_id, competence_id, required_level, mandatory")
      .eq("position_id", positionId);

    if (reqError) {
      console.error(reqError);
      throw reqError;
    }
    requirementRows = (reqData ?? []) as RequirementRow[];
  }

  // 4) Employee competences - employee already verified to belong to org above
  // Note: employee_competences doesn't have org_id, but is scoped via employee.org_id
  const { data: empCompData, error: empCompError } = await supabase
    .from("employee_competences")
    .select("id, employee_id, competence_id, level, valid_from, valid_to")
    .eq("employee_id", employeeId);

  if (empCompError) {
    console.error(empCompError);
    throw empCompError;
  }

  const employeeCompRows = (empCompData ?? []) as EmployeeCompetenceRow[];
  const empCompByCompetenceId = new Map<string, EmployeeCompetenceRow>();
  for (const row of employeeCompRows) {
    empCompByCompetenceId.set(row.competence_id, row);
  }

  // 5) Load all involved competences + groups
  const competenceIds = new Set<string>();
  requirementRows.forEach((r) => competenceIds.add(r.competence_id));
  employeeCompRows.forEach((r) => competenceIds.add(r.competence_id));

  const competencesById = new Map<
    string,
    CompetenceRow & { groupName: string | null }
  >();

  if (competenceIds.size > 0) {
    const { data: compData, error: compError } = await supabase
      .from("competences")
      .select("id, name, description, code, group_id, is_safety_critical")
      .in("id", Array.from(competenceIds))
      .eq("org_id", effectiveOrgId);

    if (compError) {
      console.error(compError);
      throw compError;
    }

    const comps = (compData ?? []) as CompetenceRow[];

    const groupIds = new Set<string>();
    comps.forEach((c) => {
      if (c.group_id) groupIds.add(c.group_id);
    });

    let groupById = new Map<string, string>();
    if (groupIds.size > 0) {
      // Filter competence_groups by org_id
      // Note: If competence_groups doesn't have org_id column, this will fail and needs schema update
      // Competences are already filtered by org_id, so groups are implicitly scoped through competences
      const { data: groupData, error: groupError } = await supabase
        .from("competence_groups")
        .select("id, name")
        .in("id", Array.from(groupIds))
        .eq("org_id", effectiveOrgId);

      if (groupError) {
        console.error(groupError);
      } else {
        (groupData ?? []).forEach((g) => {
          const gr = g as GroupRow;
          groupById.set(gr.id, gr.name);
        });
      }
    }

    comps.forEach((c) => {
      competencesById.set(c.id, {
        ...c,
        groupName: c.group_id ? (groupById.get(c.group_id) ?? null) : null,
      });
    });
  }

  function isExpired(validTo: string | null): boolean {
    if (!validTo) return false;
    return validTo < effectiveDateStr;
  }

  const items: EmployeeCompetenceItem[] = [];
  let totalRequired = 0;
  let gapCount = 0;
  let expiredCount = 0;

  const usedCompetenceIds = new Set<string>();

  // 6) Build items for all requirements (rollkrav)
  for (const req of requirementRows) {
    const compInfo = competencesById.get(req.competence_id);
    if (!compInfo) continue;

    const empComp = empCompByCompetenceId.get(req.competence_id) ?? null;

    let status: "OK" | "GAP" | "RISK" | "N/A" = "N/A";
    let riskReason: string | null = null;
    let empLevel: number | null = empComp ? empComp.level : null;
    const validTo = empComp?.valid_to ?? null;

    if (req.mandatory) {
      totalRequired += 1;

      if (!empComp) {
        status = "RISK";
        riskReason = "Saknar kompetens";
        gapCount += 1;
      } else if (isExpired(validTo)) {
        status = "RISK";
        riskReason = "Utgången giltighet";
        gapCount += 1;
        expiredCount += 1;
      } else if (empLevel! < req.required_level) {
        if (empLevel! >= req.required_level - 1) {
          status = "GAP";
          riskReason = "En nivå under krav";
          gapCount += 1;
        } else {
          status = "RISK";
          riskReason = "För låg nivå";
          gapCount += 1;
        }
      } else {
        status = "OK";
      }
    } else {
      // ej obligatorisk men definierad
      status = empComp ? "OK" : "N/A";
    }

    items.push({
      competenceId: compInfo.id,
      competenceName: compInfo.name,
      competenceCode: compInfo.code ?? null,
      groupName: compInfo.groupName,
      requiredLevel: req.required_level,
      mandatory: req.mandatory,
      employeeLevel: empLevel,
      validTo,
      status,
      riskReason,
      isSafetyCritical: compInfo.is_safety_critical,
    });

    usedCompetenceIds.add(compInfo.id);
  }

  // 7) Extra kompetenser som inte finns i rollkraven (nice-to-have / historik)
  for (const empComp of employeeCompRows) {
    if (usedCompetenceIds.has(empComp.competence_id)) continue;
    const compInfo = competencesById.get(empComp.competence_id);
    if (!compInfo) continue;

    items.push({
      competenceId: compInfo.id,
      competenceName: compInfo.name,
      competenceCode: compInfo.code ?? null,
      groupName: compInfo.groupName,
      requiredLevel: null,
      mandatory: false,
      employeeLevel: empComp.level,
      validTo: empComp.valid_to,
      status: isExpired(empComp.valid_to) ? "RISK" : "N/A",
      riskReason: isExpired(empComp.valid_to) ? "Utgången giltighet" : null,
      isSafetyCritical: compInfo.is_safety_critical,
    });
  }

  // 8) Summary / risk score
  const coveragePercent =
    totalRequired === 0
      ? 100
      : Math.round(((totalRequired - gapCount) / totalRequired) * 100);

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (gapCount === 0) {
    riskLevel = "LOW";
  } else if (gapCount <= 2) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "HIGH";
  }

  // Sortera per grupp + namn
  items.sort((a, b) => {
    const g1 = a.groupName ?? "";
    const g2 = b.groupName ?? "";
    if (g1 !== g2) return g1.localeCompare(g2);
    return a.competenceName.localeCompare(b.competenceName);
  });

  return {
    employee: {
      id: employeeRow.id,
      name: employeeName,
      positionName,
    },
    summary: {
      riskLevel,
      gapCount,
      totalRequired,
      coveragePercent,
      expiredCount,
    },
    items,
  };
}

export type PositionCoverageSummary = {
  positionId: string;
  positionName: string;
  site: string | null;
  department: string | null;
  minHeadcount: number;
  availableCount: number;
  gap: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
};

export async function getPositionCoverageForDate(
  effectiveDate: string,
  orgId?: string
): Promise<PositionCoverageSummary[]> {
  if (!orgId) return [];
  let positions: {
    id: string;
    name: string;
    site: string | null;
    department: string | null;
    minHeadcount: number;
  }[] = [];

  const result = await supabase
    .from('positions')
    .select('id, name, site, department, min_headcount')
    .gt('min_headcount', 0);

  if (result.error) {
    const errorCode = (result.error as any).code;
    if (errorCode === '42703' || result.error.message?.includes('min_headcount')) {
      console.warn('min_headcount column not found, returning empty positions list');
      return [];
    }
    throw result.error;
  }

  positions = (result.data ?? []).map((p: any) => ({
    id: p.id as string,
    name: p.name as string,
    site: (p.site ?? null) as string | null,
    department: (p.department ?? null) as string | null,
    minHeadcount: p.min_headcount as number,
  }));

  const results: PositionCoverageSummary[] = [];

  for (const pos of positions) {
    const employees = await getEmployeesForPosition(pos.id, orgId);

    if (employees.length === 0) {
      results.push({
        positionId: pos.id,
        positionName: pos.name,
        site: pos.site,
        department: pos.department,
        minHeadcount: pos.minHeadcount,
        availableCount: 0,
        gap: pos.minHeadcount,
        riskLevel: 'HIGH',
      });
      continue;
    }

    let availableCount = 0;

    for (const emp of employees) {
      const profile = await getEmployeeCompetenceProfile(
        emp.id,
        effectiveDate,
        orgId
      );

      const isFullyCompetent = profile.summary.gapCount === 0;

      if (isFullyCompetent) {
        availableCount += 1;
      }
    }

    const gap = Math.max(0, pos.minHeadcount - availableCount);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (gap > 0 && availableCount === 0) {
      riskLevel = 'HIGH';
    } else if (gap > 0) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    results.push({
      positionId: pos.id,
      positionName: pos.name,
      site: pos.site,
      department: pos.department,
      minHeadcount: pos.minHeadcount,
      availableCount,
      gap,
      riskLevel,
    });
  }

  const riskRank: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };

  results.sort((a, b) => {
    const rDiff = riskRank[a.riskLevel] - riskRank[b.riskLevel];
    if (rDiff !== 0) return rDiff;
    return a.positionName.localeCompare(b.positionName);
  });

  return results;
}
