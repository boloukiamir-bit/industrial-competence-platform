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
        lineCode: m.machine.lineCode,
        isCritical: false,
        notes: undefined,
      } as PLMachine,
      assignments: (m.assignments || []).map((a: any) => ({
        id: a.id,
        orgId: "",
        planDate: a.planDate,
        shiftType: a.shiftType as ShiftType,
        machineCode: a.machineCode,
        employeeCode: a.employeeCode,
        startTime: a.startTime,
        endTime: a.endTime,
        roleNote: a.roleNote,
      } as PLAssignmentSegment)),
      requiredHours: m.requiredHours,
      assignedHours: m.assignedHours,
      gap: m.gap,
      overAssigned: m.overAssigned || 0,
      status: m.status as "ok" | "partial" | "gap" | "over" | "no_demand",
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
    totalOverAssigned: lineData.totalOverAssigned || 0,
  } as LineWithMachines));

  const employees: PLEmployee[] = (data.employees || []).map((e: any) => ({
    id: e.id,
    orgId: "",
    employeeCode: e.employeeCode,
    fullName: e.fullName,
  }));

  const metrics: LineOverviewMetrics = {
    hasDemand: data.kpis?.hasDemand ?? false,
    coveragePercent: data.kpis?.coveragePercent ?? null,
    totalGapHours: data.kpis?.gapHours ?? null,
    overAssignedHours: data.kpis?.overAssignedHours || 0,
    presentCount: data.kpis?.presentCount || 0,
    partialCount: data.kpis?.partialCount || 0,
    absentCount: data.kpis?.absentCount || 0,
  };

  const attendance: PLAttendance[] = (data.attendance || []).map((a: any) => ({
    id: a.id,
    orgId: "",
    planDate: a.planDate,
    shiftType: a.shiftType as ShiftType,
    employeeCode: a.employeeCode,
    status: a.status as "present" | "absent" | "partial",
    availableFrom: a.availableFrom,
    availableTo: a.availableTo,
    note: a.note,
  }));

  return {
    lines,
    employees,
    metrics,
    attendance,
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
        lineCode: m.machine.lineCode,
        isCritical: false,
        notes: undefined,
      } as PLMachine,
      assignments: (m.assignments || []).map((a: any) => ({
        id: a.id,
        orgId: "",
        planDate: a.planDate,
        shiftType: a.shiftType as ShiftType,
        machineCode: a.machineCode,
        employeeCode: a.employeeCode,
        startTime: a.startTime,
        endTime: a.endTime,
        roleNote: a.roleNote,
      } as PLAssignmentSegment)),
      requiredHours: m.requiredHours,
      assignedHours: m.assignedHours,
      gap: m.gap,
      overAssigned: m.overAssigned || 0,
      status: m.status as "ok" | "partial" | "gap" | "over" | "no_demand",
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
    totalOverAssigned: lineData.totalOverAssigned || 0,
  } as LineWithMachines));

  const metrics: LineOverviewMetrics = {
    hasDemand: data.kpis?.hasDemand ?? false,
    coveragePercent: data.kpis?.coveragePercent ?? null,
    totalGapHours: data.kpis?.gapHours ?? null,
    overAssignedHours: data.kpis?.overAssignedHours || 0,
    presentCount: data.kpis?.presentCount || 0,
    partialCount: data.kpis?.partialCount || 0,
    absentCount: data.kpis?.absentCount || 0,
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
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string })?.error || "Failed to create assignment");
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
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string })?.error || "Failed to update assignment");
  }

  return response.json();
}
