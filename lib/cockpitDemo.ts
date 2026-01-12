"use client";

import type {
  Action,
  Station,
  Shift,
  ShiftAssignment,
  ComplianceItem,
  SafetyObservation,
  StationStaffingCard,
  CockpitMetrics,
  PlanVsActual,
} from "@/types/cockpit";

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

const now = new Date();

export const DEMO_EMPLOYEES_COCKPIT = [
  { id: "emp-001", name: "Anna Lindberg" },
  { id: "emp-002", name: "Erik Johansson" },
  { id: "emp-003", name: "Maria Svensson" },
  { id: "emp-004", name: "Karl Andersson" },
  { id: "emp-005", name: "Sofia Berg" },
  { id: "emp-006", name: "Johan Nilsson" },
  { id: "emp-007", name: "Emma Larsson" },
  { id: "emp-008", name: "Oscar Olsson" },
  { id: "emp-009", name: "Lisa Eriksson" },
  { id: "emp-010", name: "Anders Persson" },
];

export const DEMO_SHIFTS: Shift[] = [
  { id: "shift-day", orgId: "demo-org", name: "Day", code: "D", startTime: "06:00", endTime: "14:00", isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "shift-evening", orgId: "demo-org", name: "Evening", code: "E", startTime: "14:00", endTime: "22:00", isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "shift-night", orgId: "demo-org", name: "Night", code: "N", startTime: "22:00", endTime: "06:00", isActive: true, createdAt: TODAY, updatedAt: TODAY },
];

export const DEMO_STATIONS: Station[] = [
  { id: "st-001", orgId: "demo-org", name: "Pressline A", code: "PL-A", line: "Press", area: "Production", capacity: 1, isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "st-002", orgId: "demo-org", name: "Pressline B", code: "PL-B", line: "Press", area: "Production", capacity: 1, isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "st-003", orgId: "demo-org", name: "Assembly 1", code: "AS-1", line: "Assembly", area: "Production", capacity: 1, isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "st-004", orgId: "demo-org", name: "Assembly 2", code: "AS-2", line: "Assembly", area: "Production", capacity: 1, isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "st-005", orgId: "demo-org", name: "Quality Control", code: "QC-1", line: "QC", area: "Quality", capacity: 1, isActive: true, createdAt: TODAY, updatedAt: TODAY },
  { id: "st-006", orgId: "demo-org", name: "Logistics Hub", code: "LOG-1", line: "Logistics", area: "Warehouse", capacity: 1, isActive: true, createdAt: TODAY, updatedAt: TODAY },
];

export const DEMO_COMPLIANCE: ComplianceItem[] = [
  { id: "comp-001", orgId: "demo-org", employeeId: "emp-001", employeeName: "Anna Lindberg", type: "certification", title: "Forklift License", issuedDate: addDays(now, -365), expiryDate: addDays(now, -5), status: "expired", createdAt: TODAY, updatedAt: TODAY },
  { id: "comp-002", orgId: "demo-org", employeeId: "emp-002", employeeName: "Erik Johansson", type: "training", title: "Safety Training", issuedDate: addDays(now, -300), expiryDate: addDays(now, 10), status: "expiring_soon", createdAt: TODAY, updatedAt: TODAY },
  { id: "comp-003", orgId: "demo-org", employeeId: "emp-003", employeeName: "Maria Svensson", type: "medical", title: "Medical Checkup", issuedDate: addDays(now, -180), expiryDate: addDays(now, 25), status: "expiring_soon", createdAt: TODAY, updatedAt: TODAY },
  { id: "comp-004", orgId: "demo-org", employeeId: "emp-004", employeeName: "Karl Andersson", type: "certification", title: "Crane Operator", issuedDate: addDays(now, -400), expiryDate: addDays(now, -15), status: "expired", createdAt: TODAY, updatedAt: TODAY },
  { id: "comp-005", orgId: "demo-org", employeeId: "emp-005", employeeName: "Sofia Berg", type: "training", title: "Fire Safety", issuedDate: addDays(now, -100), expiryDate: addDays(now, 265), status: "valid", createdAt: TODAY, updatedAt: TODAY },
];

export const DEMO_ACTIONS: Action[] = [
  { id: "act-001", orgId: "demo-org", title: "Renew Anna's forklift license", description: "License expired 5 days ago", domain: "people", severity: "critical", status: "open", dueDate: addDays(now, 2), ownerId: "emp-006", ownerName: "Johan Nilsson", relatedEmployeeId: "emp-001", relatedEmployeeName: "Anna Lindberg", impact: "Cannot operate forklift", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-002", orgId: "demo-org", title: "Replace damaged safety guard on PL-A", description: "Guard bent after incident", domain: "safety", severity: "high", status: "open", dueDate: addDays(now, 1), ownerId: "emp-008", ownerName: "Oscar Olsson", relatedStationId: "st-001", relatedStationName: "Pressline A", impact: "Production blocked", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-003", orgId: "demo-org", title: "Schedule Erik's safety training", description: "Expires in 10 days", domain: "people", severity: "medium", status: "open", dueDate: addDays(now, 5), ownerId: "emp-006", ownerName: "Johan Nilsson", relatedEmployeeId: "emp-002", relatedEmployeeName: "Erik Johansson", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-004", orgId: "demo-org", title: "Calibrate quality measurement tool", description: "Monthly calibration due", domain: "ops", severity: "medium", status: "open", dueDate: addDays(now, 3), ownerId: "emp-005", ownerName: "Sofia Berg", relatedStationId: "st-005", relatedStationName: "Quality Control", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-005", orgId: "demo-org", title: "Fix oil leak in Assembly 2", description: "Small leak detected yesterday", domain: "ops", severity: "low", status: "open", dueDate: addDays(now, 7), ownerId: "emp-008", ownerName: "Oscar Olsson", relatedStationId: "st-004", relatedStationName: "Assembly 2", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-006", orgId: "demo-org", title: "Update emergency evacuation plan", description: "Annual review required", domain: "safety", severity: "medium", status: "open", dueDate: addDays(now, 14), ownerId: "emp-006", ownerName: "Johan Nilsson", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-007", orgId: "demo-org", title: "Order new PPE for new hires", description: "3 new employees starting next week", domain: "people", severity: "medium", status: "open", dueDate: addDays(now, 4), ownerId: "emp-007", ownerName: "Emma Larsson", createdAt: TODAY, updatedAt: TODAY },
  { id: "act-008", orgId: "demo-org", title: "Review crane operator recertification", description: "Karl's cert expired", domain: "people", severity: "high", status: "open", dueDate: addDays(now, 1), ownerId: "emp-006", ownerName: "Johan Nilsson", relatedEmployeeId: "emp-004", relatedEmployeeName: "Karl Andersson", createdAt: TODAY, updatedAt: TODAY },
];

export const DEMO_SAFETY_OBSERVATIONS: SafetyObservation[] = [
  { id: "obs-001", orgId: "demo-org", title: "Wet floor near entrance", description: "Water leak from AC unit", severity: "medium", location: "Main entrance", status: "open", observedAt: addDays(now, -1) + "T09:30:00Z", createdAt: TODAY, updatedAt: TODAY },
  { id: "obs-002", orgId: "demo-org", title: "Missing guard on conveyor", description: "Protective cover removed and not replaced", severity: "high", location: "Assembly line", stationId: "st-003", stationName: "Assembly 1", status: "action_created", actionId: "act-002", observedAt: addDays(now, -2) + "T14:15:00Z", createdAt: TODAY, updatedAt: TODAY },
  { id: "obs-003", orgId: "demo-org", title: "Frayed cable near workstation", description: "Power cable showing wear", severity: "medium", location: "Press area", stationId: "st-001", stationName: "Pressline A", status: "open", observedAt: addDays(now, -3) + "T11:00:00Z", createdAt: TODAY, updatedAt: TODAY },
  { id: "obs-004", orgId: "demo-org", title: "Good housekeeping in QC", description: "Area well organized and clean", severity: "low", location: "Quality Control", stationId: "st-005", stationName: "Quality Control", status: "resolved", observedAt: addDays(now, -4) + "T08:45:00Z", createdAt: TODAY, updatedAt: TODAY },
  { id: "obs-005", orgId: "demo-org", title: "Blocked emergency exit", description: "Pallets stored in front of exit door", severity: "high", location: "Warehouse", stationId: "st-006", stationName: "Logistics Hub", status: "open", observedAt: addDays(now, 0) + "T07:30:00Z", createdAt: TODAY, updatedAt: TODAY },
];

export const DEMO_SHIFT_ASSIGNMENTS: ShiftAssignment[] = [
  { id: "sa-001", orgId: "demo-org", shiftId: "shift-day", stationId: "st-001", employeeId: "emp-001", employeeName: "Anna Lindberg", assignmentDate: TODAY, status: "assigned", createdAt: TODAY, updatedAt: TODAY },
  { id: "sa-002", orgId: "demo-org", shiftId: "shift-day", stationId: "st-002", employeeId: "emp-002", employeeName: "Erik Johansson", assignmentDate: TODAY, status: "assigned", createdAt: TODAY, updatedAt: TODAY },
  { id: "sa-003", orgId: "demo-org", shiftId: "shift-day", stationId: "st-003", employeeId: "emp-003", employeeName: "Maria Svensson", assignmentDate: TODAY, status: "assigned", createdAt: TODAY, updatedAt: TODAY },
  { id: "sa-004", orgId: "demo-org", shiftId: "shift-day", stationId: "st-004", employeeId: undefined, employeeName: undefined, assignmentDate: TODAY, status: "unassigned", createdAt: TODAY, updatedAt: TODAY },
  { id: "sa-005", orgId: "demo-org", shiftId: "shift-day", stationId: "st-005", employeeId: "emp-005", employeeName: "Sofia Berg", assignmentDate: TODAY, status: "assigned", createdAt: TODAY, updatedAt: TODAY },
  { id: "sa-006", orgId: "demo-org", shiftId: "shift-day", stationId: "st-006", employeeId: "emp-004", employeeName: "Karl Andersson", assignmentDate: TODAY, status: "assigned", createdAt: TODAY, updatedAt: TODAY },
];

export function getDemoStaffingCards(): StationStaffingCard[] {
  return DEMO_STATIONS.map((station) => {
    const assignment = DEMO_SHIFT_ASSIGNMENTS.find(a => a.stationId === station.id);
    const employeeId = assignment?.employeeId;
    const compliance = DEMO_COMPLIANCE.filter(c => c.employeeId === employeeId);
    
    let status: "green" | "yellow" | "red" = "red";
    const issues: ComplianceItem[] = [];

    if (employeeId) {
      const hasExpired = compliance.some(c => c.status === "expired");
      const hasExpiring = compliance.some(c => c.status === "expiring_soon");

      if (hasExpired) {
        status = "red";
        issues.push(...compliance.filter(c => c.status === "expired"));
      } else if (hasExpiring) {
        status = "yellow";
        issues.push(...compliance.filter(c => c.status === "expiring_soon"));
      } else {
        status = "green";
      }
    }

    return {
      station,
      assignment,
      employee: employeeId ? { id: employeeId, name: assignment?.employeeName || "Unknown" } : undefined,
      complianceStatus: status,
      complianceIssues: issues,
    };
  });
}

export function getDemoCockpitMetrics(): CockpitMetrics {
  const openActions = DEMO_ACTIONS.filter(a => a.status === "open");
  const criticalActions = openActions.filter(a => a.severity === "critical");
  const staffedStations = DEMO_SHIFT_ASSIGNMENTS.filter(a => a.employeeId).length;
  const expiringCompliance = DEMO_COMPLIANCE.filter(c => c.status === "expiring_soon").length;
  const overdueCompliance = DEMO_COMPLIANCE.filter(c => c.status === "expired").length;
  const safetyObs = DEMO_SAFETY_OBSERVATIONS.filter(o => o.status === "open");
  const safetyActions = openActions.filter(a => a.domain === "safety");

  return {
    openActions: openActions.length,
    criticalActions: criticalActions.length,
    staffedStations,
    totalStations: DEMO_STATIONS.length,
    expiringCompliance,
    overdueCompliance,
    safetyObservationsThisWeek: DEMO_SAFETY_OBSERVATIONS.length,
    openSafetyActions: safetyActions.length,
  };
}

export function getDemoPlanVsActual(): PlanVsActual[] {
  return [
    { label: "Mon", plan: 120, actual: 115 },
    { label: "Tue", plan: 120, actual: 122 },
    { label: "Wed", plan: 120, actual: 118 },
    { label: "Thu", plan: 120, actual: 125 },
    { label: "Fri", plan: 100, actual: 98 },
    { label: "Sat", plan: 80, actual: 82 },
    { label: "Sun", plan: 60, actual: 58 },
  ];
}
