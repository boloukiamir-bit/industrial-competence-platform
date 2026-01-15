export const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export type SPRatingScale = {
  id: string;
  orgId: string;
  level: number;
  label: string;
  description: string | null;
  color: string | null;
};

export type SPArea = {
  id: string;
  orgId: string;
  areaCode: string;
  areaName: string;
};

export type SPStation = {
  id: string;
  orgId: string;
  areaId: string | null;
  stationCode: string;
  stationName: string;
  sortOrder: number;
};

export type SPSkill = {
  id: string;
  orgId: string;
  skillId: string;
  skillName: string;
  stationId: string | null;
  category: string | null;
  description: string | null;
  sortOrder: number;
};

export type SPEmployee = {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  email: string | null;
  areaId: string | null;
  employmentType: string;
  isActive: boolean;
};

export type SPEmployeeSkill = {
  id: string;
  orgId: string;
  employeeId: string;
  skillId: string;
  rating: number | null;
  assessedDate: string | null;
  assessedBy: string | null;
  notes: string | null;
};

export type SPAreaLeader = {
  id: string;
  orgId: string;
  areaId: string;
  employeeId: string;
  isPrimary: boolean;
};

export type SPImportLog = {
  id: string;
  orgId: string;
  importType: string;
  fileName: string | null;
  totalRows: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  failedRows: { line: number; reason: string }[];
  importedBy: string | null;
  createdAt: string;
};

export type ImportResult = {
  success: boolean;
  importType: string;
  totalRows: number;
  inserted: number;
  updated: number;
  failed: number;
  failedRows: { line: number; reason: string }[];
};

export type SkillGapData = {
  stationCode: string;
  stationName: string;
  skillId: string;
  skillName: string;
  independentCount: number;
  totalEmployees: number;
  employees: { employeeId: string; employeeName: string; rating: number | null }[];
  riskLevel: "ok" | "warning" | "critical";
};

export type DashboardKPIs = {
  totalEmployees: number;
  totalStations: number;
  totalSkills: number;
  averageIndependentRate: number;
};

export type TopRiskStation = {
  stationCode: string;
  stationName: string;
  independentCount: number;
  totalSkills: number;
  riskScore: number;
};
