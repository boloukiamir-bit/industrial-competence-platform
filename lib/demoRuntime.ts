"use client";

import type { Employee, Skill, OrgUnit, GapItem } from "@/types/domain";
import {
  DEMO_EMPLOYEES,
  DEMO_SKILLS,
  DEMO_POSITIONS,
  DEMO_ORG_UNITS,
  DEMO_REQUIREMENTS,
  DEMO_EMPLOYEE_SKILLS,
} from "./demoData";

const DEMO_ORG = {
  id: "demo-org-001",
  name: "Nadiplan Demo Manufacturing",
  slug: "nadiplan-demo",
  createdAt: "2024-01-01T00:00:00Z",
};

export function isDemoMode(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("demo") === "1" || urlParams.get("demo") === "true") {
    sessionStorage.setItem("nadiplan_demo_mode", "true");
    return true;
  }
  
  if (sessionStorage.getItem("nadiplan_demo_mode") === "true") {
    return true;
  }
  
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function enableDemoMode(): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("nadiplan_demo_mode", "true");
  }
}

export function disableDemoMode(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("nadiplan_demo_mode");
  }
}

export function getDemoOrg() {
  return DEMO_ORG;
}

export function getDemoEmployees(): Employee[] {
  return DEMO_EMPLOYEES.map((e) => ({
    id: e.id,
    name: e.name,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    employeeNumber: e.employeeNumber,
    role: e.role,
    line: e.line,
    team: e.team,
    employmentType: "permanent" as const,
    startDate: e.startDate,
    isActive: e.isActive,
  }));
}

export function getDemoSkills(): Skill[] {
  return DEMO_SKILLS.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    category: s.groupName,
    description: `${s.name} skill for industrial operations`,
  }));
}

export function getDemoPositions() {
  return DEMO_POSITIONS.map((p) => ({
    id: p.id,
    name: p.name,
    line: p.line,
    minHeadcount: p.minHeadcount,
  }));
}

export function getDemoOrgUnits(): OrgUnit[] {
  return DEMO_ORG_UNITS.map((u) => ({
    id: u.id,
    name: u.name,
    code: u.code,
    type: u.type.toLowerCase() as OrgUnit["type"],
    parentId: u.parentId || undefined,
    createdAt: "2024-01-01T00:00:00Z",
    employeeCount: u.employeeCount,
  }));
}

export function getDemoRequirements() {
  return DEMO_REQUIREMENTS.map((r) => ({
    positionId: r.positionId,
    positionName: DEMO_POSITIONS.find((p) => p.id === r.positionId)?.name || "",
    skillId: r.skillId,
    skillName: DEMO_SKILLS.find((s) => s.id === r.skillId)?.name || "",
    requiredLevel: r.requiredLevel,
  }));
}

export function getDemoEmployeeSkills() {
  return DEMO_EMPLOYEE_SKILLS.map((es) => ({
    employeeId: es.employeeId,
    skillId: es.skillId,
    level: es.level as 0 | 1 | 2 | 3 | 4,
    skillName: DEMO_SKILLS.find((s) => s.id === es.skillId)?.name || "",
    skillCode: DEMO_SKILLS.find((s) => s.id === es.skillId)?.code || "",
  }));
}

export function getDemoGaps(): GapItem[] {
  const gaps: GapItem[] = [];
  const employees = getDemoEmployees();
  const employeeSkills = getDemoEmployeeSkills();
  const requirements = getDemoRequirements();
  const positions = getDemoPositions();

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
        skillName: req.skillName,
        skillId: req.skillId,
        requiredLevel: req.requiredLevel,
        currentAvgLevel: Math.round(avgLevel * 10) / 10,
        missingCount,
      });
    }
  }

  return gaps.sort((a, b) => b.missingCount - a.missingCount);
}

export function getDemoMetrics() {
  const employees = getDemoEmployees();
  const gaps = getDemoGaps();
  const activeEmployees = employees.filter((e) => e.isActive);
  
  const atRiskCount = gaps.reduce((acc, g) => acc + g.missingCount, 0);
  const topGapSkill = gaps[0]?.skillName || "None";
  
  const totalSkillAssessments = getDemoEmployeeSkills().length;
  const avgReadiness = totalSkillAssessments > 0 
    ? Math.round((getDemoEmployeeSkills().reduce((acc, s) => acc + s.level, 0) / (totalSkillAssessments * 4)) * 100)
    : 0;

  return {
    totalEmployees: activeEmployees.length,
    atRiskCount,
    topGapSkill,
    avgReadiness,
    totalPositions: getDemoPositions().length,
    totalSkills: getDemoSkills().length,
    totalOrgUnits: getDemoOrgUnits().length,
    gapCount: gaps.length,
  };
}

export function getDemoEvents() {
  const employees = getDemoEmployees();
  const today = new Date();
  
  const addDays = (date: Date, days: number): string => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().slice(0, 10);
  };

  return [
    {
      id: "evt-001",
      employeeId: employees[0]?.id || "E1001",
      employeeName: employees[0]?.name || "Anna Lindberg",
      category: "certification" as const,
      title: "Forklift License Renewal",
      description: "Annual forklift operator certification renewal",
      dueDate: addDays(today, -5),
      completedDate: undefined,
      recurrence: "12m",
      ownerManagerId: "mgr-001",
      status: "overdue" as const,
      notes: "",
    },
    {
      id: "evt-002",
      employeeId: employees[1]?.id || "E1002",
      employeeName: employees[1]?.name || "Erik Johansson",
      category: "safety" as const,
      title: "Safety Training",
      description: "Mandatory annual safety training",
      dueDate: addDays(today, 15),
      completedDate: undefined,
      recurrence: "12m",
      ownerManagerId: "mgr-001",
      status: "due_soon" as const,
      notes: "",
    },
    {
      id: "evt-003",
      employeeId: employees[2]?.id || "E1003",
      employeeName: employees[2]?.name || "Maria Svensson",
      category: "review" as const,
      title: "Performance Review",
      description: "Annual performance review",
      dueDate: addDays(today, 45),
      completedDate: undefined,
      recurrence: "12m",
      ownerManagerId: "mgr-001",
      status: "due_soon" as const,
      notes: "",
    },
    {
      id: "evt-004",
      employeeId: employees[3]?.id || "E1004",
      employeeName: employees[3]?.name || "Karl Andersson",
      category: "onboarding" as const,
      title: "90-Day Check-in",
      description: "New employee 90-day review",
      dueDate: addDays(today, 90),
      completedDate: undefined,
      recurrence: undefined,
      ownerManagerId: "mgr-001",
      status: "upcoming" as const,
      notes: "",
    },
  ];
}

export function getDemoScript(): string {
  return `NADIPLAN DEMO SCRIPT
====================

1. DASHBOARD
   - Show key metrics: employees, at-risk count, readiness percentage
   - Highlight the top gap skill that needs attention

2. EMPLOYEES
   - Browse the employee list
   - Click "Add Employee" to show the form
   - Click "Import CSV" to demonstrate bulk import

3. ORGANIZATION OVERVIEW
   - Show the org hierarchy tree
   - Click "Create Unit" to add departments

4. COMPETENCE MATRIX
   - Show skill levels across employees
   - Point out OK/GAP/RISK status badges
   - Click "Export CSV" to download data

5. TOMORROW'S GAPS
   - Click "Generate" to analyze skill gaps
   - Show the summary: top missing skills
   - Review the gaps table with severity
   - Export gaps report as CSV

6. WRAP-UP
   - Navigate back to Dashboard
   - Mention CTA: "Start Your Free Trial"
`;
}

export const DEMO_CHECKLIST = [
  { step: 1, title: "Dashboard", description: "Verify metrics show non-zero values" },
  { step: 2, title: "Employees", description: "List shows 10 employees, buttons visible" },
  { step: 3, title: "Organization", description: "Org tree displays 5 units" },
  { step: 4, title: "Competence Matrix", description: "Matrix shows skills with status badges" },
  { step: 5, title: "Tomorrow's Gaps", description: "Generate shows summary and table" },
  { step: 6, title: "Export", description: "CSV download works on Matrix and Gaps" },
];
