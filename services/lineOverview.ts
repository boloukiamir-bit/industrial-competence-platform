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
import { withDevBearer } from "@/lib/devBearer";
import { fetchJson, type FetchJsonResult } from "@/lib/coreFetch";

type ApiError = Error & { status?: number };

function makeApiError(status: number, message: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  return error;
}

export async function fetchLineOverviewDataResult(
  planDate: string,
  shiftType: ShiftType
): Promise<FetchJsonResult<any>> {
  const shiftParam = shiftType.toLowerCase();
  return fetchJson<LineOverviewData & { weekDates?: string[] }>(
    `/api/line-overview?date=${planDate}&shift=${shiftParam}`
  );
}

export async function fetchWeekOverviewDataResult(
  startDate: string,
  shiftType: ShiftType
): Promise<FetchJsonResult<any>> {
  const shiftParam = shiftType.toLowerCase();
  return fetchJson<LineOverviewData & { weekDates?: string[] }>(
    `/api/line-overview/week?startDate=${startDate}&shift=${shiftParam}`
  );
}

export function mapLineOverviewApiData(data: any): LineOverviewData {
  const lines: LineWithMachines[] = (data.lines || []).map((lineData: any) => ({
    line: {
      id: lineData.lineCode,
      orgId: "",
      lineCode: lineData.lineCode,
      lineName: lineData.lineName,
      departmentCode: "",
      notes: undefined,
    } as PLLine,
    machines: lineData.machines.map((m: any) => ({
      machine: {
        id: m.machine.id,
        orgId: "",
        stationId: m.machine.stationId ?? m.machine.id,
        stationCode: m.machine.stationCode ?? m.machine.machineCode,
        stationName: m.machine.stationName ?? m.machine.machineName,
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
        stationId: a.stationId,
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
    totalRequiredHours: lineData.demandHours ?? 0,
    totalAssignedHours: lineData.assignedHours ?? 0,
    totalGap: lineData.gapHours ?? 0,
    totalOverAssigned: lineData.overAssignedHours ?? 0,
  } as LineWithMachines));

  const employees: PLEmployee[] = (data.employees || []).map((e: any) => {
    const num = e.employee_number ?? e.employeeCode;
    return {
      id: e.id,
      orgId: "",
      employeeNumber: num,
      employeeCode: num,
      fullName: e.fullName ?? e.name ?? "",
    };
  });

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
  const result = await fetchWeekOverviewDataResult(startDate, shiftType);
  if (!result.ok) {
    throw makeApiError(
      result.status,
      result.error ? `Failed to fetch week overview data: ${result.error}` : "Failed to fetch week overview data"
    );
  }
  return mapWeekOverviewApiData(result.data);
}

export function mapWeekOverviewApiData(
  data: any
): LineOverviewData & { weekDates: string[] } {
  const lines: LineWithMachines[] = (data.lines || []).map((lineData: any) => ({
    line: {
      id: lineData.lineCode,
      orgId: "",
      lineCode: lineData.lineCode,
      lineName: lineData.lineName,
      departmentCode: "",
      notes: undefined,
    } as PLLine,
    machines: lineData.machines.map((m: any) => ({
      machine: {
        id: m.machine.id,
        orgId: "",
        stationId: m.machine.stationId ?? m.machine.id,
        stationCode: m.machine.stationCode ?? m.machine.machineCode,
        stationName: m.machine.stationName ?? m.machine.machineName,
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
        stationId: a.stationId,
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
    totalRequiredHours: lineData.demandHours ?? 0,
    totalAssignedHours: lineData.assignedHours ?? 0,
    totalGap: lineData.gapHours ?? 0,
    totalOverAssigned: lineData.overAssignedHours ?? 0,
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

export async function fetchLineOverviewData(
  planDate: string,
  shiftType: ShiftType
): Promise<LineOverviewData> {
  const result = await fetchLineOverviewDataResult(planDate, shiftType);
  if (!result.ok) {
    throw makeApiError(
      result.status,
      result.error ? `Failed to fetch line overview data: ${result.error}` : "Failed to fetch line overview data"
    );
  }
  return mapLineOverviewApiData(result.data);
}

export async function getSuggestions(
  lineCode: string,
  machineCode: string,
  date: string,
  shift: ShiftType,
  hoursNeeded: number,
  options?: { includeAbsent?: boolean }
): Promise<EmployeeSuggestion[]> {
  const shiftParam = shift.toLowerCase();
  const response = await fetch("/api/line-overview/suggestions", {
    method: "POST",
    headers: withDevBearer({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({
      machineCode,
      date,
      shift: shiftParam,
      hoursNeeded,
      includeAbsent: options?.includeAbsent ?? false,
    }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to get suggestions");
  }
  
  const data = await response.json();
  const suggestions = (data.suggestions || []).map((s: any) => {
    const num = s.employee?.employee_number ?? s.employee?.employeeCode ?? "";
    return {
      employee: {
        id: s.employee.id,
        orgId: "",
        employeeNumber: num,
        employeeCode: num,
        fullName: s.employee.full_name ?? s.employee.fullName ?? "",
      } as PLEmployee,
      currentAssignedHours: s.currentHours,
      availableHours: s.availableHours,
      score: s.score,
    } as EmployeeSuggestion;
  });

  const eligibilityRes = await fetch(`/api/eligibility/line?line=${encodeURIComponent(lineCode)}`, {
    credentials: "include",
    headers: withDevBearer(),
  });
  if (!eligibilityRes.ok) {
    const body = await eligibilityRes.json().catch(() => ({}));
    const message = (body as { error?: string })?.error;
    throw new Error(message ? `Failed to fetch eligibility: ${message}` : "Failed to fetch eligibility");
  }

  const eligibilityData = await eligibilityRes.json();
  const stationsRequired = eligibilityData?.stations_required ?? 0;
  const requiredSkillsCount = eligibilityData?.required_skills_count ?? 0;
  const eligibilityByNumber = new Map<
    string,
    { eligible: boolean; stationsPassed: number; skillsPassedCount: number; requiredSkillsCount: number }
  >(
    (eligibilityData?.employees || []).map((emp: any) => [
      emp.employee_number,
      {
        eligible: !!emp.eligible,
        stationsPassed: emp.stations_passed ?? 0,
        skillsPassedCount: emp.skills_passed_count ?? 0,
        requiredSkillsCount: emp.required_skills_count ?? requiredSkillsCount,
      },
    ])
  );

  return suggestions.map((suggestion: EmployeeSuggestion) => {
    const eligibility = eligibilityByNumber.get(suggestion.employee.employeeNumber);
    return {
      ...suggestion,
      eligible: eligibility?.eligible ?? false,
      stationsPassed: eligibility?.stationsPassed ?? 0,
      stationsRequired,
      skillsPassedCount: eligibility?.skillsPassedCount,
      requiredSkillsCount: eligibility?.requiredSkillsCount ?? requiredSkillsCount,
    };
  });
}

export async function createAssignment(params: {
  stationId?: string;
  machineCode?: string;
  employeeCode: string;
  date: string;
  shift: ShiftType;
  startTime: string;
  endTime: string;
}): Promise<{ success: boolean; assignment?: any }> {
  const body: Record<string, unknown> = {
    employeeCode: params.employeeCode,
    date: params.date,
    shift: params.shift.toLowerCase(),
    startTime: params.startTime,
    endTime: params.endTime,
  };
  if (params.stationId) body.stationId = params.stationId;
  else if (params.machineCode) body.machineCode = params.machineCode;

  const response = await fetch("/api/line-overview/assignments", {
    method: "POST",
    headers: withDevBearer({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
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
    headers: withDevBearer(),
    credentials: "include",
  });
  
  return response.ok;
}

export async function updateAssignment(
  assignmentId: string,
  updates: { startTime?: string; endTime?: string; employeeCode?: string }
): Promise<{ success: boolean; assignment?: any }> {
  const response = await fetch(`/api/line-overview/assignments/${assignmentId}`, {
    method: "PATCH",
    headers: withDevBearer({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string })?.error || "Failed to update assignment");
  }

  return response.json();
}
