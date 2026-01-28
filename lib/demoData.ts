const isProd = process.env.NODE_ENV === 'production';

export interface DemoEmployee {
  id: string;
  employeeNumber: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  line: string;
  team: string;
  startDate: string;
  isActive: boolean;
}

export interface DemoSkill {
  id: string;
  code: string;
  name: string;
  groupId: string;
  groupName: string;
}

export interface DemoPosition {
  id: string;
  name: string;
  line: string;
  minHeadcount: number;
}

export interface DemoOrgUnit {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  employeeCount: number;
}

export interface DemoRequirement {
  positionId: string;
  skillId: string;
  requiredLevel: number;
}

export interface DemoEmployeeSkill {
  employeeId: string;
  skillId: string;
  level: number;
}

const DEMO_EMPLOYEES_DATA: DemoEmployee[] = [
  { id: "E1001", employeeNumber: "E1001", name: "Anna Lindberg", firstName: "Anna", lastName: "Lindberg", email: "anna.lindberg@example.com", role: "Operator", line: "Pressline 1", team: "Day Shift", startDate: "2020-03-15", isActive: true },
  { id: "E1002", employeeNumber: "E1002", name: "Erik Johansson", firstName: "Erik", lastName: "Johansson", email: "erik.johansson@example.com", role: "Operator", line: "Pressline 1", team: "Day Shift", startDate: "2019-06-01", isActive: true },
  { id: "E1003", employeeNumber: "E1003", name: "Maria Svensson", firstName: "Maria", lastName: "Svensson", email: "maria.svensson@example.com", role: "Team Lead", line: "Pressline 1", team: "Day Shift", startDate: "2018-01-10", isActive: true },
  { id: "E1004", employeeNumber: "E1004", name: "Karl Andersson", firstName: "Karl", lastName: "Andersson", email: "karl.andersson@example.com", role: "Operator", line: "Pressline 1", team: "Night Shift", startDate: "2021-09-20", isActive: true },
  { id: "E1005", employeeNumber: "E1005", name: "Sofia Nilsson", firstName: "Sofia", lastName: "Nilsson", email: "sofia.nilsson@example.com", role: "Operator", line: "Pressline 2", team: "Day Shift", startDate: "2022-02-14", isActive: true },
  { id: "E1006", employeeNumber: "E1006", name: "Lars Pettersson", firstName: "Lars", lastName: "Pettersson", email: "lars.pettersson@example.com", role: "Team Lead", line: "Pressline 2", team: "Day Shift", startDate: "2017-05-22", isActive: true },
  { id: "E1007", employeeNumber: "E1007", name: "Emma Gustafsson", firstName: "Emma", lastName: "Gustafsson", email: "emma.gustafsson@example.com", role: "Quality Inspector", line: "Quality Control", team: "Day Shift", startDate: "2020-11-03", isActive: true },
  { id: "E1008", employeeNumber: "E1008", name: "Oscar Eriksson", firstName: "Oscar", lastName: "Eriksson", email: "oscar.eriksson@example.com", role: "Operator", line: "Assembly", team: "Day Shift", startDate: "2021-04-18", isActive: true },
  { id: "E1009", employeeNumber: "E1009", name: "Maja Larsson", firstName: "Maja", lastName: "Larsson", email: "maja.larsson@example.com", role: "Operator", line: "Assembly", team: "Night Shift", startDate: "2019-08-25", isActive: true },
  { id: "E1010", employeeNumber: "E1010", name: "Viktor Olsson", firstName: "Viktor", lastName: "Olsson", email: "viktor.olsson@example.com", role: "Logistics Coordinator", line: "Logistics", team: "Day Shift", startDate: "2018-12-01", isActive: true },
];

export const DEMO_EMPLOYEES: DemoEmployee[] = isProd ? [] : DEMO_EMPLOYEES_DATA;

const DEMO_SKILLS_DATA: DemoSkill[] = [
  { id: "SK001", code: "PRESS_A", name: "Pressline A Operation", groupId: "G1", groupName: "Production" },
  { id: "SK002", code: "PRESS_B", name: "Pressline B Operation", groupId: "G1", groupName: "Production" },
  { id: "SK003", code: "SAFETY_BASIC", name: "Safety Basic", groupId: "G2", groupName: "Safety" },
  { id: "SK004", code: "SAFETY_ADV", name: "Safety Advanced", groupId: "G2", groupName: "Safety" },
  { id: "SK005", code: "TRUCK_A1", name: "Truck A1 License", groupId: "G3", groupName: "Certifications" },
  { id: "SK006", code: "TRUCK_B1", name: "Truck B1 License", groupId: "G3", groupName: "Certifications" },
  { id: "SK007", code: "QUALITY_INSP", name: "Quality Inspection", groupId: "G4", groupName: "Quality" },
  { id: "SK008", code: "FIRST_AID", name: "First Aid Certified", groupId: "G2", groupName: "Safety" },
];

export const DEMO_SKILLS: DemoSkill[] = isProd ? [] : DEMO_SKILLS_DATA;

const DEMO_POSITIONS_DATA: DemoPosition[] = [
  { id: "P1", name: "Pressline 1 Operator", line: "Pressline 1", minHeadcount: 4 },
  { id: "P2", name: "Pressline 2 Operator", line: "Pressline 2", minHeadcount: 3 },
  { id: "P3", name: "Assembly Operator", line: "Assembly", minHeadcount: 3 },
  { id: "P4", name: "Quality Inspector", line: "Quality Control", minHeadcount: 2 },
  { id: "P5", name: "Logistics Coordinator", line: "Logistics", minHeadcount: 2 },
];

export const DEMO_POSITIONS: DemoPosition[] = isProd ? [] : DEMO_POSITIONS_DATA;

const DEMO_ORG_UNITS_DATA: DemoOrgUnit[] = [
  { id: "OU1", name: "Manufacturing Division", code: "MFG", type: "Division", parentId: null, employeeCount: 10 },
  { id: "OU2", name: "Pressline Department", code: "PRESS", type: "Department", parentId: "OU1", employeeCount: 6 },
  { id: "OU3", name: "Assembly Department", code: "ASSY", type: "Department", parentId: "OU1", employeeCount: 2 },
  { id: "OU4", name: "Quality Department", code: "QC", type: "Department", parentId: "OU1", employeeCount: 1 },
  { id: "OU5", name: "Logistics Department", code: "LOG", type: "Department", parentId: "OU1", employeeCount: 1 },
];

export const DEMO_ORG_UNITS: DemoOrgUnit[] = isProd ? [] : DEMO_ORG_UNITS_DATA;

const DEMO_REQUIREMENTS_DATA: DemoRequirement[] = [
  { positionId: "P1", skillId: "SK001", requiredLevel: 3 },
  { positionId: "P1", skillId: "SK002", requiredLevel: 2 },
  { positionId: "P1", skillId: "SK003", requiredLevel: 3 },
  { positionId: "P1", skillId: "SK005", requiredLevel: 2 },
  { positionId: "P2", skillId: "SK001", requiredLevel: 2 },
  { positionId: "P2", skillId: "SK002", requiredLevel: 3 },
  { positionId: "P2", skillId: "SK003", requiredLevel: 3 },
  { positionId: "P3", skillId: "SK003", requiredLevel: 2 },
  { positionId: "P3", skillId: "SK008", requiredLevel: 2 },
  { positionId: "P4", skillId: "SK007", requiredLevel: 4 },
  { positionId: "P4", skillId: "SK003", requiredLevel: 3 },
  { positionId: "P5", skillId: "SK005", requiredLevel: 3 },
  { positionId: "P5", skillId: "SK006", requiredLevel: 2 },
];

export const DEMO_REQUIREMENTS: DemoRequirement[] = isProd ? [] : DEMO_REQUIREMENTS_DATA;

const DEMO_EMPLOYEE_SKILLS_DATA: DemoEmployeeSkill[] = [
  { employeeId: "E1001", skillId: "SK001", level: 4 },
  { employeeId: "E1001", skillId: "SK002", level: 2 },
  { employeeId: "E1001", skillId: "SK003", level: 3 },
  { employeeId: "E1001", skillId: "SK005", level: 1 },
  { employeeId: "E1002", skillId: "SK001", level: 3 },
  { employeeId: "E1002", skillId: "SK002", level: 1 },
  { employeeId: "E1002", skillId: "SK003", level: 2 },
  { employeeId: "E1002", skillId: "SK005", level: 0 },
  { employeeId: "E1003", skillId: "SK001", level: 4 },
  { employeeId: "E1003", skillId: "SK002", level: 4 },
  { employeeId: "E1003", skillId: "SK003", level: 4 },
  { employeeId: "E1003", skillId: "SK005", level: 3 },
  { employeeId: "E1004", skillId: "SK001", level: 2 },
  { employeeId: "E1004", skillId: "SK002", level: 0 },
  { employeeId: "E1004", skillId: "SK003", level: 1 },
  { employeeId: "E1004", skillId: "SK005", level: 2 },
  { employeeId: "E1005", skillId: "SK001", level: 2 },
  { employeeId: "E1005", skillId: "SK002", level: 3 },
  { employeeId: "E1005", skillId: "SK003", level: 3 },
  { employeeId: "E1006", skillId: "SK001", level: 3 },
  { employeeId: "E1006", skillId: "SK002", level: 4 },
  { employeeId: "E1006", skillId: "SK003", level: 4 },
  { employeeId: "E1007", skillId: "SK007", level: 4 },
  { employeeId: "E1007", skillId: "SK003", level: 3 },
  { employeeId: "E1008", skillId: "SK003", level: 2 },
  { employeeId: "E1008", skillId: "SK008", level: 2 },
  { employeeId: "E1009", skillId: "SK003", level: 3 },
  { employeeId: "E1009", skillId: "SK008", level: 3 },
  { employeeId: "E1010", skillId: "SK005", level: 4 },
  { employeeId: "E1010", skillId: "SK006", level: 3 },
];

export const DEMO_EMPLOYEE_SKILLS: DemoEmployeeSkill[] = isProd ? [] : DEMO_EMPLOYEE_SKILLS_DATA;

/** Demo data only when explicitly enabled. Default false. Production never. */
export function isDemoMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function getDemoMetrics() {
  if (isProd) {
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      totalSkills: 0,
      totalPositions: 0,
      totalOrgUnits: 0,
      employeesAtRisk: 0,
      totalGaps: 0,
      criticalGaps: 0,
      topGapSkill: "",
      averageReadiness: 0,
    };
  }

  const employeesAtRisk = 3;
  const totalGaps = 5;
  const criticalGaps = 2;
  
  return {
    totalEmployees: DEMO_EMPLOYEES.length,
    activeEmployees: DEMO_EMPLOYEES.filter(e => e.isActive).length,
    totalSkills: DEMO_SKILLS.length,
    totalPositions: DEMO_POSITIONS.length,
    totalOrgUnits: DEMO_ORG_UNITS.length,
    employeesAtRisk,
    totalGaps,
    criticalGaps,
    topGapSkill: "Truck A1 License",
    averageReadiness: 78,
  };
}
