import type {
  PLLine,
  PLMachine,
  PLEmployee,
  PLAttendance,
  PLAssignmentSegment,
  LineWithMachines,
  MachineWithData,
  LineOverviewData,
  LineOverviewMetrics,
  ShiftType,
  EmployeeSuggestion,
} from "@/types/lineOverview";

export async function fetchLineOverviewData(
  planDate: string,
  shiftType: ShiftType
): Promise<LineOverviewData> {
  const shiftParam = shiftType.toLowerCase();
  const response = await fetch(`/api/line-overview?date=${planDate}&shift=${shiftParam}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch line overview data");
  }
  
  const data = await response.json();
  
  const lines: LineWithMachines[] = (data.lines || []).map((lineData: any) => ({
    line: {
      id: lineData.line.id,
      orgId: "",
      lineCode: lineData.line.lineCode,
      lineName: lineData.line.lineName,
      departmentCode: "",
      notes: undefined,
    } as PLLine,
    machines: lineData.machines.map((m: any) => ({
      machine: {
        id: m.machine.id,
        orgId: "",
        machineCode: m.machine.machineCode,
        machineName: m.machine.machineName,
        lineCode: m.machine.lineId,
        isCritical: false,
        notes: undefined,
      } as PLMachine,
      assignments: [],
      requiredHours: m.requiredHours,
      assignedHours: m.assignedHours,
      gap: m.gap,
      status: m.status === "gap" ? "red" : m.status === "partial" ? "yellow" : "green" as "green" | "yellow" | "red",
      assignedPeople: (m.assignedPeople || []).map((p: any) => ({
        employeeCode: p.employeeCode,
        employeeName: p.employeeName,
        startTime: p.startTime,
        endTime: p.endTime,
      })),
    } as MachineWithData)),
    totalRequiredHours: lineData.totalRequired,
    totalAssignedHours: lineData.totalAssigned,
    totalGap: lineData.totalGap,
  } as LineWithMachines));

  const employees: PLEmployee[] = (data.employees || []).map((e: any) => ({
    id: e.id,
    orgId: "",
    employeeCode: e.employeeCode,
    fullName: e.fullName,
  }));

  const metrics: LineOverviewMetrics = {
    coveragePercent: data.kpis?.coveragePercent || 100,
    totalGapHours: data.kpis?.gapHours || 0,
    overtimeHours: data.kpis?.overtimeHours || 0,
    presentCount: data.kpis?.presentCount || 0,
    absentCount: data.kpis?.absentCount || 0,
    partialCount: 0,
  };

  return {
    lines,
    employees,
    metrics,
    attendance: [],
  };
}

export async function fetchWeekOverviewData(
  startDate: string,
  shiftType: ShiftType
): Promise<LineOverviewData & { weekDates: string[] }> {
  const shiftParam = shiftType.toLowerCase();
  const response = await fetch(`/api/line-overview/week?startDate=${startDate}&shift=${shiftParam}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch week overview data");
  }
  
  const data = await response.json();
  
  const lines: LineWithMachines[] = (data.lines || []).map((lineData: any) => ({
    line: {
      id: lineData.line.id,
      orgId: "",
      lineCode: lineData.line.lineCode,
      lineName: lineData.line.lineName,
      departmentCode: "",
      notes: undefined,
    } as PLLine,
    machines: lineData.machines.map((m: any) => ({
      machine: {
        id: m.machine.id,
        orgId: "",
        machineCode: m.machine.machineCode,
        machineName: m.machine.machineName,
        lineCode: m.machine.lineId,
        isCritical: false,
        notes: undefined,
      } as PLMachine,
      assignments: [],
      requiredHours: m.requiredHours,
      assignedHours: m.assignedHours,
      gap: m.gap,
      status: m.status === "gap" ? "red" : m.status === "partial" ? "yellow" : "green" as "green" | "yellow" | "red",
      assignedPeople: [],
    } as MachineWithData)),
    totalRequiredHours: lineData.totalRequired,
    totalAssignedHours: lineData.totalAssigned,
    totalGap: lineData.totalGap,
  } as LineWithMachines));

  const metrics: LineOverviewMetrics = {
    coveragePercent: data.kpis?.coveragePercent || 100,
    totalGapHours: data.kpis?.gapHours || 0,
    overtimeHours: data.kpis?.overtimeHours || 0,
    presentCount: 0,
    absentCount: 0,
    partialCount: 0,
  };

  return {
    lines,
    employees: [],
    metrics,
    attendance: [],
    weekDates: data.weekDates || [],
  };
}

export async function getSuggestions(
  machineCode: string,
  date: string,
  shift: ShiftType,
  hoursNeeded: number
): Promise<EmployeeSuggestion[]> {
  const shiftParam = shift.toLowerCase();
  const response = await fetch("/api/line-overview/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machineCode, date, shift: shiftParam, hoursNeeded }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to get suggestions");
  }
  
  const data = await response.json();
  return (data.suggestions || []).map((s: any) => ({
    employee: {
      id: s.employee.id,
      orgId: "",
      employeeCode: s.employee.employeeCode,
      fullName: s.employee.fullName,
    } as PLEmployee,
    currentAssignedHours: s.currentHours,
    availableHours: s.availableHours,
    score: s.score,
  }));
}

export async function createAssignment(params: {
  machineCode: string;
  employeeCode: string;
  date: string;
  shift: ShiftType;
  startTime: string;
  endTime: string;
}): Promise<{ success: boolean; assignment?: any }> {
  const response = await fetch("/api/line-overview/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params,
      shift: params.shift.toLowerCase(),
    }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to create assignment");
  }
  
  return response.json();
}

export async function deleteAssignment(assignmentId: string): Promise<boolean> {
  const response = await fetch(`/api/line-overview/assignments/${assignmentId}`, {
    method: "DELETE",
  });
  
  return response.ok;
}

export async function updateAssignment(
  assignmentId: string,
  updates: { startTime?: string; endTime?: string; employeeCode?: string }
): Promise<{ success: boolean; assignment?: any }> {
  const response = await fetch(`/api/line-overview/assignments/${assignmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update assignment");
  }
  
  return response.json();
}
