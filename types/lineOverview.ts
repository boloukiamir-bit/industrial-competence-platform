export type ShiftType = "Day" | "Evening" | "Night";

export interface PLLine {
  id: string;
  orgId: string;
  lineCode: string;
  lineName: string;
  departmentCode: string;
  notes?: string;
}

export interface PLMachine {
  id: string;
  orgId: string;
  machineCode: string;
  machineName: string;
  lineCode: string;
  machineType?: string;
  isCritical: boolean;
  notes?: string;
}

export interface PLEmployee {
  id: string;
  orgId: string;
  employeeCode: string;
  fullName: string;
  departmentCode?: string;
  defaultLineCode?: string;
  employmentType?: string;
  weeklyCapacityHours?: number;
  managerCode?: string;
}

export interface PLMachineDemand {
  id: string;
  orgId: string;
  planDate: string;
  shiftType: ShiftType;
  machineCode: string;
  requiredHours: number;
  priority: number;
  comment?: string;
}

export interface PLAttendance {
  id: string;
  orgId: string;
  planDate: string;
  shiftType: ShiftType;
  employeeCode: string;
  status: "present" | "absent" | "partial";
  availableFrom?: string;
  availableTo?: string;
  note?: string;
}

export interface PLAssignmentSegment {
  id: string;
  orgId: string;
  planDate: string;
  shiftType: ShiftType;
  machineCode: string;
  employeeCode?: string;
  startTime: string;
  endTime: string;
  roleNote?: string;
}

export interface PLOvertimeOverride {
  id: string;
  orgId: string;
  planDate: string;
  shiftType: ShiftType;
  employeeCode: string;
  machineCode?: string;
  startTime?: string;
  endTime?: string;
  hours?: number;
  reason?: string;
  approvedBy?: string;
}

export interface MachineWithData {
  machine: PLMachine;
  demand?: PLMachineDemand;
  assignments: PLAssignmentSegment[];
  requiredHours: number;
  assignedHours: number;
  gap: number;
  overAssigned: number;
  status: "ok" | "partial" | "gap" | "over" | "no_demand";
  assignedPeople: {
    employeeCode: string;
    employeeName: string;
    startTime: string;
    endTime: string;
  }[];
}

export interface LineWithMachines {
  line: PLLine;
  machines: MachineWithData[];
  totalRequiredHours: number;
  totalAssignedHours: number;
  totalGap: number;
  totalOverAssigned: number;
}

export interface LineOverviewMetrics {
  hasDemand: boolean;
  coveragePercent: number | null;
  totalGapHours: number | null;
  overAssignedHours: number;
  presentCount: number;
  partialCount: number;
  absentCount: number;
}

export interface LineOverviewData {
  lines: LineWithMachines[];
  metrics: LineOverviewMetrics;
  attendance: PLAttendance[];
  employees: PLEmployee[];
}

export interface EmployeeSuggestion {
  employee: PLEmployee;
  currentAssignedHours: number;
  availableHours: number;
  score: number;
}
