import { supabase } from "@/lib/supabaseClient";
import type {
  PLLine,
  PLMachine,
  PLEmployee,
  PLMachineDemand,
  PLAttendance,
  PLAssignmentSegment,
  PLOvertimeOverride,
  LineWithMachines,
  MachineWithData,
  LineOverviewData,
  LineOverviewMetrics,
  ShiftType,
  EmployeeSuggestion,
} from "@/types/lineOverview";

const ORG_ID = "f607f244-da91-41d9-a648-d02a1591105c";

function timeToHours(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}

function calculateSegmentHours(startTime: string, endTime: string): number {
  const start = timeToHours(startTime);
  let end = timeToHours(endTime);
  if (end < start) end += 24;
  return end - start;
}

function getMachineStatus(gap: number, hasAssignments: boolean): "green" | "yellow" | "red" {
  if (!hasAssignments) return "red";
  if (gap <= 0) return "green";
  if (gap <= 2) return "yellow";
  return "red";
}

export async function fetchLineOverviewData(
  planDate: string,
  shiftType: ShiftType
): Promise<LineOverviewData> {
  const [
    linesResult,
    machinesResult,
    employeesResult,
    demandResult,
    attendanceResult,
    assignmentsResult,
    overtimeResult,
  ] = await Promise.all([
    supabase
      .from("pl_lines")
      .select("*")
      .eq("org_id", ORG_ID)
      .order("line_code"),
    supabase
      .from("pl_machines")
      .select("*")
      .eq("org_id", ORG_ID)
      .order("machine_code"),
    supabase
      .from("pl_employees")
      .select("*")
      .eq("org_id", ORG_ID)
      .order("full_name"),
    supabase
      .from("pl_machine_demand")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("plan_date", planDate)
      .eq("shift_type", shiftType),
    supabase
      .from("pl_attendance")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("plan_date", planDate)
      .eq("shift_type", shiftType),
    supabase
      .from("pl_assignment_segments")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("plan_date", planDate)
      .eq("shift_type", shiftType),
    supabase
      .from("pl_overtime_overrides")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("plan_date", planDate)
      .eq("shift_type", shiftType),
  ]);

  const lines: PLLine[] = (linesResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    departmentCode: row.department_code,
    notes: row.notes,
  }));

  const machines: PLMachine[] = (machinesResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    machineCode: row.machine_code,
    machineName: row.machine_name,
    lineCode: row.line_code,
    machineType: row.machine_type,
    isCritical: row.is_critical,
    notes: row.notes,
  }));

  const employees: PLEmployee[] = (employeesResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    departmentCode: row.department_code,
    defaultLineCode: row.default_line_code,
    employmentType: row.employment_type,
    weeklyCapacityHours: row.weekly_capacity_hours,
    managerCode: row.manager_code,
  }));

  const demands: PLMachineDemand[] = (demandResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    planDate: row.plan_date,
    shiftType: row.shift_type,
    machineCode: row.machine_code,
    requiredHours: Number(row.required_hours),
    priority: row.priority,
    comment: row.comment,
  }));

  const attendance: PLAttendance[] = (attendanceResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    planDate: row.plan_date,
    shiftType: row.shift_type,
    employeeCode: row.employee_code,
    status: row.status,
    availableFrom: row.available_from,
    availableTo: row.available_to,
    note: row.note,
  }));

  const assignments: PLAssignmentSegment[] = (assignmentsResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    planDate: row.plan_date,
    shiftType: row.shift_type,
    machineCode: row.machine_code,
    employeeCode: row.employee_code,
    startTime: row.start_time,
    endTime: row.end_time,
    roleNote: row.role_note,
  }));

  const overtime: PLOvertimeOverride[] = (overtimeResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    planDate: row.plan_date,
    shiftType: row.shift_type,
    employeeCode: row.employee_code,
    machineCode: row.machine_code,
    startTime: row.start_time,
    endTime: row.end_time,
    hours: row.hours ? Number(row.hours) : undefined,
    reason: row.reason,
    approvedBy: row.approved_by,
  }));

  const demandByMachine = new Map(demands.map((d) => [d.machineCode, d]));
  const assignmentsByMachine = new Map<string, PLAssignmentSegment[]>();
  assignments.forEach((a) => {
    const list = assignmentsByMachine.get(a.machineCode) || [];
    list.push(a);
    assignmentsByMachine.set(a.machineCode, list);
  });

  const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

  const machinesByLine = new Map<string, PLMachine[]>();
  machines.forEach((m) => {
    const list = machinesByLine.get(m.lineCode) || [];
    list.push(m);
    machinesByLine.set(m.lineCode, list);
  });

  const linesWithMachines: LineWithMachines[] = lines.map((line) => {
    const lineMachines = machinesByLine.get(line.lineCode) || [];
    const machinesWithData: MachineWithData[] = lineMachines.map((machine) => {
      const demand = demandByMachine.get(machine.machineCode);
      const machineAssignments = assignmentsByMachine.get(machine.machineCode) || [];
      const requiredHours = demand?.requiredHours || 0;
      const assignedHours = machineAssignments.reduce(
        (sum, a) => sum + calculateSegmentHours(a.startTime, a.endTime),
        0
      );
      const gap = requiredHours - assignedHours;
      const status = getMachineStatus(gap, machineAssignments.length > 0 || requiredHours === 0);
      const assignedPeople = machineAssignments
        .filter((a) => a.employeeCode)
        .map((a) => {
          const emp = employeeByCode.get(a.employeeCode!);
          return {
            employeeCode: a.employeeCode!,
            employeeName: emp?.fullName || a.employeeCode!,
            startTime: a.startTime,
            endTime: a.endTime,
          };
        });

      return {
        machine,
        demand,
        assignments: machineAssignments,
        requiredHours,
        assignedHours,
        gap,
        status,
        assignedPeople,
      };
    });

    const totalRequiredHours = machinesWithData.reduce((sum, m) => sum + m.requiredHours, 0);
    const totalAssignedHours = machinesWithData.reduce((sum, m) => sum + m.assignedHours, 0);
    const totalGap = totalRequiredHours - totalAssignedHours;

    return {
      line,
      machines: machinesWithData,
      totalRequiredHours,
      totalAssignedHours,
      totalGap,
    };
  }).filter((l) => l.machines.length > 0);

  const totalRequiredHours = linesWithMachines.reduce((sum, l) => sum + l.totalRequiredHours, 0);
  const totalAssignedHours = linesWithMachines.reduce((sum, l) => sum + l.totalAssignedHours, 0);
  const coveragePercent = totalRequiredHours > 0 
    ? Math.round((totalAssignedHours / totalRequiredHours) * 100) 
    : 100;
  const totalGapHours = Math.max(0, totalRequiredHours - totalAssignedHours);
  const overtimeHours = overtime.reduce((sum, o) => sum + (o.hours || 0), 0);
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const partialCount = attendance.filter((a) => a.status === "partial").length;

  const metrics: LineOverviewMetrics = {
    coveragePercent,
    totalGapHours,
    overtimeHours,
    presentCount,
    absentCount,
    partialCount,
  };

  return {
    lines: linesWithMachines,
    metrics,
    attendance,
    employees,
  };
}

export async function fetchWeekOverviewData(
  weekStartDate: string,
  shiftType: ShiftType
): Promise<LineOverviewData> {
  const weekDates: string[] = [];
  const startDate = new Date(weekStartDate);
  for (let i = 0; i < 5; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    weekDates.push(d.toISOString().split("T")[0]);
  }

  const [
    linesResult,
    machinesResult,
    employeesResult,
    demandResult,
    attendanceResult,
    assignmentsResult,
    overtimeResult,
  ] = await Promise.all([
    supabase.from("pl_lines").select("*").eq("org_id", ORG_ID).order("line_code"),
    supabase.from("pl_machines").select("*").eq("org_id", ORG_ID).order("machine_code"),
    supabase.from("pl_employees").select("*").eq("org_id", ORG_ID).order("full_name"),
    supabase
      .from("pl_machine_demand")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("shift_type", shiftType)
      .gte("plan_date", weekDates[0])
      .lte("plan_date", weekDates[weekDates.length - 1]),
    supabase
      .from("pl_attendance")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("shift_type", shiftType)
      .gte("plan_date", weekDates[0])
      .lte("plan_date", weekDates[weekDates.length - 1]),
    supabase
      .from("pl_assignment_segments")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("shift_type", shiftType)
      .gte("plan_date", weekDates[0])
      .lte("plan_date", weekDates[weekDates.length - 1]),
    supabase
      .from("pl_overtime_overrides")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("shift_type", shiftType)
      .gte("plan_date", weekDates[0])
      .lte("plan_date", weekDates[weekDates.length - 1]),
  ]);

  const lines: PLLine[] = (linesResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    departmentCode: row.department_code,
    notes: row.notes,
  }));

  const machines: PLMachine[] = (machinesResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    machineCode: row.machine_code,
    machineName: row.machine_name,
    lineCode: row.line_code,
    machineType: row.machine_type,
    isCritical: row.is_critical,
    notes: row.notes,
  }));

  const employees: PLEmployee[] = (employeesResult.data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    departmentCode: row.department_code,
    defaultLineCode: row.default_line_code,
    employmentType: row.employment_type,
    weeklyCapacityHours: row.weekly_capacity_hours,
    managerCode: row.manager_code,
  }));

  const demands = (demandResult.data || []) as any[];
  const attendance = (attendanceResult.data || []) as any[];
  const assignments = (assignmentsResult.data || []) as any[];
  const overtime = (overtimeResult.data || []) as any[];

  const demandByMachine = new Map<string, number>();
  demands.forEach((d) => {
    const current = demandByMachine.get(d.machine_code) || 0;
    demandByMachine.set(d.machine_code, current + Number(d.required_hours));
  });

  const assignmentsByMachine = new Map<string, number>();
  assignments.forEach((a) => {
    const hours = calculateSegmentHours(a.start_time, a.end_time);
    const current = assignmentsByMachine.get(a.machine_code) || 0;
    assignmentsByMachine.set(a.machine_code, current + hours);
  });

  const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));
  const machinesByLine = new Map<string, PLMachine[]>();
  machines.forEach((m) => {
    const list = machinesByLine.get(m.lineCode) || [];
    list.push(m);
    machinesByLine.set(m.lineCode, list);
  });

  const linesWithMachines: LineWithMachines[] = lines.map((line) => {
    const lineMachines = machinesByLine.get(line.lineCode) || [];
    const machinesWithData: MachineWithData[] = lineMachines.map((machine) => {
      const requiredHours = demandByMachine.get(machine.machineCode) || 0;
      const assignedHours = assignmentsByMachine.get(machine.machineCode) || 0;
      const gap = requiredHours - assignedHours;
      const status = getMachineStatus(gap, assignedHours > 0 || requiredHours === 0);

      return {
        machine,
        assignments: [],
        requiredHours,
        assignedHours,
        gap,
        status,
        assignedPeople: [],
      };
    });

    const totalRequiredHours = machinesWithData.reduce((sum, m) => sum + m.requiredHours, 0);
    const totalAssignedHours = machinesWithData.reduce((sum, m) => sum + m.assignedHours, 0);
    const totalGap = totalRequiredHours - totalAssignedHours;

    return {
      line,
      machines: machinesWithData,
      totalRequiredHours,
      totalAssignedHours,
      totalGap,
    };
  }).filter((l) => l.machines.length > 0);

  const totalRequiredHours = linesWithMachines.reduce((sum, l) => sum + l.totalRequiredHours, 0);
  const totalAssignedHours = linesWithMachines.reduce((sum, l) => sum + l.totalAssignedHours, 0);
  const coveragePercent = totalRequiredHours > 0 
    ? Math.round((totalAssignedHours / totalRequiredHours) * 100) 
    : 100;
  const totalGapHours = Math.max(0, totalRequiredHours - totalAssignedHours);
  const overtimeHours = overtime.reduce((sum: number, o: any) => sum + (Number(o.hours) || 0), 0);

  const presentCount = new Set(
    attendance.filter((a: any) => a.status === "present").map((a: any) => a.employee_code)
  ).size;
  const absentCount = new Set(
    attendance.filter((a: any) => a.status === "absent").map((a: any) => a.employee_code)
  ).size;
  const partialCount = new Set(
    attendance.filter((a: any) => a.status === "partial").map((a: any) => a.employee_code)
  ).size;

  const formattedAttendance: PLAttendance[] = attendance.map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    planDate: row.plan_date,
    shiftType: row.shift_type,
    employeeCode: row.employee_code,
    status: row.status,
    availableFrom: row.available_from,
    availableTo: row.available_to,
    note: row.note,
  }));

  return {
    lines: linesWithMachines,
    metrics: {
      coveragePercent,
      totalGapHours,
      overtimeHours,
      presentCount,
      absentCount,
      partialCount,
    },
    attendance: formattedAttendance,
    employees,
  };
}

export async function getSuggestions(
  planDate: string,
  shiftType: ShiftType,
  machineCode: string,
  gapHours: number
): Promise<EmployeeSuggestion[]> {
  const [attendanceResult, assignmentsResult, employeesResult] = await Promise.all([
    supabase
      .from("pl_attendance")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("plan_date", planDate)
      .eq("shift_type", shiftType)
      .in("status", ["present", "partial"]),
    supabase
      .from("pl_assignment_segments")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("plan_date", planDate)
      .eq("shift_type", shiftType),
    supabase.from("pl_employees").select("*").eq("org_id", ORG_ID),
  ]);

  const attendance = attendanceResult.data || [];
  const assignments = assignmentsResult.data || [];
  const employees = employeesResult.data || [];

  const employeeByCode = new Map(
    employees.map((e: any) => [
      e.employee_code,
      {
        id: e.id,
        orgId: e.org_id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
        departmentCode: e.department_code,
        defaultLineCode: e.default_line_code,
        employmentType: e.employment_type,
        weeklyCapacityHours: e.weekly_capacity_hours,
        managerCode: e.manager_code,
      } as PLEmployee,
    ])
  );

  const hoursPerEmployee = new Map<string, number>();
  assignments.forEach((a: any) => {
    const hours = calculateSegmentHours(a.start_time, a.end_time);
    const current = hoursPerEmployee.get(a.employee_code) || 0;
    hoursPerEmployee.set(a.employee_code, current + hours);
  });

  const suggestions: EmployeeSuggestion[] = [];

  for (const att of attendance) {
    const empCode = att.employee_code;
    const employee = employeeByCode.get(empCode);
    if (!employee) continue;

    const currentHours = hoursPerEmployee.get(empCode) || 0;
    const maxHours = att.status === "partial" ? 4 : 8;
    const availableHours = Math.max(0, maxHours - currentHours);

    if (availableHours <= 0) continue;

    const score = 100 - (currentHours / 8) * 50;

    suggestions.push({
      employee,
      currentAssignedHours: currentHours,
      availableHours,
      score,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, 3);
}

export async function createAssignment(
  planDate: string,
  shiftType: ShiftType,
  machineCode: string,
  employeeCode: string,
  startTime: string,
  endTime: string,
  roleNote?: string
): Promise<PLAssignmentSegment | null> {
  const { data, error } = await supabase
    .from("pl_assignment_segments")
    .insert({
      org_id: ORG_ID,
      plan_date: planDate,
      shift_type: shiftType,
      machine_code: machineCode,
      employee_code: employeeCode,
      start_time: startTime,
      end_time: endTime,
      role_note: roleNote,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create assignment:", error);
    return null;
  }

  return {
    id: data.id,
    orgId: data.org_id,
    planDate: data.plan_date,
    shiftType: data.shift_type,
    machineCode: data.machine_code,
    employeeCode: data.employee_code,
    startTime: data.start_time,
    endTime: data.end_time,
    roleNote: data.role_note,
  };
}

export async function deleteAssignment(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from("pl_assignment_segments")
    .delete()
    .eq("id", assignmentId)
    .eq("org_id", ORG_ID);

  if (error) {
    console.error("Failed to delete assignment:", error);
    return false;
  }

  return true;
}

export async function updateAssignment(
  assignmentId: string,
  updates: {
    employeeCode?: string;
    startTime?: string;
    endTime?: string;
    roleNote?: string;
  }
): Promise<boolean> {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (updates.employeeCode !== undefined) updateData.employee_code = updates.employeeCode;
  if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
  if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
  if (updates.roleNote !== undefined) updateData.role_note = updates.roleNote;

  const { error } = await supabase
    .from("pl_assignment_segments")
    .update(updateData)
    .eq("id", assignmentId)
    .eq("org_id", ORG_ID);

  if (error) {
    console.error("Failed to update assignment:", error);
    return false;
  }

  return true;
}
