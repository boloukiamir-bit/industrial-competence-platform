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
    unknownCount: data.kpis?.unknownCount ?? 0,
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
    unknownCount: data.kpis?.unknownCount ?? 0,
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

/** Response shape from GET/POST /api/line-overview/suggestions (camelCase contract). */
interface SuggestionsApiCandidate {
  employee: { id: string; employeeNumber: string; fullName: string };
  currentAssignedHours: number;
  availableHours: number;
  score: number;
  eligible: boolean;
  reasons: string[];
  requiredSkillsCount: number;
  skillsPassedCount: number;
  stationCoverage: { covered: number; required: number };
}

export async function getSuggestions(
  _lineCode: string,
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

  const data = (await response.json()) as { suggestions?: SuggestionsApiCandidate[] };
  const list = data.suggestions ?? [];
  return list.map((s: SuggestionsApiCandidate) => {
    const cov = s.stationCoverage ?? { covered: 0, required: 0 };
    return {
      employee: {
        id: s.employee.id,
        orgId: "",
        employeeNumber: s.employee.employeeNumber,
        employeeCode: s.employee.employeeNumber,
        fullName: s.employee.fullName,
      } as PLEmployee,
      currentAssignedHours: s.currentAssignedHours,
      availableHours: s.availableHours,
      score: s.score,
      eligible: s.eligible,
      reasons: s.reasons ?? [],
      requiredSkillsCount: s.requiredSkillsCount,
      skillsPassedCount: s.skillsPassedCount,
      stationCoverage: cov,
      stationsPassed: cov.covered,
      stationsRequired: cov.required,
    } as EmployeeSuggestion;
  });
}

export type CreateAssignmentResult =
  | { ok: true; assignment_id?: string }
  | { ok: false; status: number; step: string; error: string; details?: unknown };

export async function createAssignment(params: {
  stationId?: string;
  machineCode?: string;
  employeeCode: string;
  date: string;
  shift: ShiftType;
  startTime: string;
  endTime: string;
}): Promise<CreateAssignmentResult> {
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
    credentials: "include",
    headers: withDevBearer({ "Content-Type": "application/json" }) as HeadersInit,
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    assignment_id?: string;
    step?: string;
    error?: string;
    details?: unknown;
  };
  if (response.ok && data?.ok !== false && ("assignment_id" in data || data?.ok === true)) {
    return { ok: true, assignment_id: data?.assignment_id };
  }
  return {
    ok: false,
    status: response.status,
    step: data?.step ?? "create",
    error: data?.error ?? response.statusText ?? "Failed to create assignment",
    details: data?.details,
  };
}

export type DeleteAssignmentResult =
  | { ok: true; assignment: unknown }
  | { ok: false; status: number; step: string; error: string; details?: unknown };

export type UpdateAssignmentResult =
  | { ok: true; assignment: unknown }
  | { ok: false; status: number; step: string; error: string; details?: unknown };

export async function deleteAssignment(assignmentId: string): Promise<DeleteAssignmentResult> {
  const response = await fetch(`/api/line-overview/assignments/${assignmentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: withDevBearer() as HeadersInit,
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    assignment?: unknown;
    step?: string;
    error?: string;
    details?: unknown;
  };
  if (response.ok && body?.ok === true && "assignment" in body) {
    return { ok: true, assignment: body.assignment };
  }
  return {
    ok: false,
    status: response.status,
    step: body?.step ?? "delete",
    error: body?.error ?? response.statusText ?? "Failed to delete assignment",
    details: body?.details,
  };
}

export async function updateAssignment(
  assignmentId: string,
  updates: { startTime?: string; endTime?: string; employeeCode?: string }
): Promise<UpdateAssignmentResult> {
  const response = await fetch(`/api/line-overview/assignments/${assignmentId}`, {
    method: "PATCH",
    credentials: "include",
    headers: withDevBearer({ "Content-Type": "application/json" }) as HeadersInit,
    body: JSON.stringify(updates),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    assignment?: unknown;
    step?: string;
    error?: string;
    details?: unknown;
  };
  if (response.ok && body?.ok === true && "assignment" in body) {
    return { ok: true, assignment: body.assignment };
  }
  return {
    ok: false,
    status: response.status,
    step: body?.step ?? "update",
    error: body?.error ?? response.statusText ?? "Failed to update assignment",
    details: body?.details,
  };
}
