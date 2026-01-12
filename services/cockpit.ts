import { supabase } from "@/lib/supabaseClient";
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
  ComplianceStatus,
  StaffingStatus,
} from "@/types/cockpit";

function calculateComplianceStatus(expiryDate?: string): ComplianceStatus {
  if (!expiryDate) return "missing";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 30) return "expiring_soon";
  return "valid";
}

export async function getTopActions(orgId: string, limit: number = 5): Promise<Action[]> {
  if (!orgId) {
    console.error("getTopActions: orgId is required");
    return [];
  }
  
  const { data, error } = await supabase
    .from("actions")
    .select(`
      *,
      owner:owner_id(name),
      related_employee:related_employee_id(name),
      related_station:related_station_id(name)
    `)
    .eq("org_id", orgId)
    .eq("status", "open")
    .order("severity", { ascending: false })
    .order("due_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch actions:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    description: row.description,
    domain: row.domain,
    severity: row.severity,
    status: row.status,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    ownerId: row.owner_id,
    ownerName: row.owner?.name,
    relatedEmployeeId: row.related_employee_id,
    relatedEmployeeName: row.related_employee?.name,
    relatedStationId: row.related_station_id,
    relatedStationName: row.related_station?.name,
    impact: row.impact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function markActionDone(actionId: string, orgId: string): Promise<void> {
  if (!actionId || !orgId) {
    throw new Error("actionId and orgId are required");
  }
  
  const { error } = await supabase
    .from("actions")
    .update({
      status: "completed",
      completed_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to mark action done: ${error.message}`);
  }
}

export async function createAction(action: Partial<Action>): Promise<Action | null> {
  const { data, error } = await supabase
    .from("actions")
    .insert({
      org_id: action.orgId,
      title: action.title,
      description: action.description,
      domain: action.domain,
      severity: action.severity || "medium",
      status: "open",
      due_date: action.dueDate,
      owner_id: action.ownerId,
      related_employee_id: action.relatedEmployeeId,
      related_station_id: action.relatedStationId,
      impact: action.impact,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create action:", error);
    return null;
  }

  return {
    id: data.id,
    orgId: data.org_id,
    title: data.title,
    description: data.description,
    domain: data.domain,
    severity: data.severity,
    status: data.status,
    dueDate: data.due_date,
    completedDate: data.completed_date,
    ownerId: data.owner_id,
    impact: data.impact,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getShifts(orgId: string): Promise<Shift[]> {
  if (!orgId) {
    console.error("getShifts: orgId is required");
    return [];
  }
  
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Failed to fetch shifts:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    code: row.code,
    startTime: row.start_time,
    endTime: row.end_time,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getStations(orgId: string): Promise<Station[]> {
  if (!orgId) {
    console.error("getStations: orgId is required");
    return [];
  }
  
  const { data, error } = await supabase
    .from("stations")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Failed to fetch stations:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    code: row.code,
    line: row.line,
    area: row.area,
    capacity: row.capacity,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getStaffingStatus(
  orgId: string,
  shiftId: string,
  date: string
): Promise<StationStaffingCard[]> {
  const stations = await getStations(orgId);
  
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select(`
      *,
      employee:employee_id(id, name)
    `)
    .eq("org_id", orgId)
    .eq("shift_id", shiftId)
    .eq("assignment_date", date);

  const { data: complianceItems } = await supabase
    .from("compliance_items")
    .select(`
      *,
      employee:employee_id(id, name)
    `)
    .eq("org_id", orgId);

  const assignmentMap = new Map<string, any>();
  (assignments || []).forEach((a: any) => {
    assignmentMap.set(a.station_id, a);
  });

  const employeeComplianceMap = new Map<string, any[]>();
  (complianceItems || []).forEach((c: any) => {
    const items = employeeComplianceMap.get(c.employee_id) || [];
    items.push(c);
    employeeComplianceMap.set(c.employee_id, items);
  });

  return stations.map((station) => {
    const assignment = assignmentMap.get(station.id);
    const employeeId = assignment?.employee_id;
    const employeeCompliance = employeeId ? employeeComplianceMap.get(employeeId) || [] : [];
    
    let staffingStatus: StaffingStatus = "red";
    const issues: ComplianceItem[] = [];

    if (employeeId) {
      const hasExpired = employeeCompliance.some(
        (c) => calculateComplianceStatus(c.expiry_date) === "expired"
      );
      const hasExpiring = employeeCompliance.some(
        (c) => calculateComplianceStatus(c.expiry_date) === "expiring_soon"
      );

      if (hasExpired) {
        staffingStatus = "red";
        employeeCompliance
          .filter((c) => calculateComplianceStatus(c.expiry_date) === "expired")
          .forEach((c) => issues.push({
            id: c.id,
            orgId: c.org_id,
            employeeId: c.employee_id,
            employeeName: c.employee?.name,
            type: c.type,
            title: c.title,
            description: c.description,
            issuedDate: c.issued_date,
            expiryDate: c.expiry_date,
            status: "expired",
            documentUrl: c.document_url,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
      } else if (hasExpiring) {
        staffingStatus = "yellow";
        employeeCompliance
          .filter((c) => calculateComplianceStatus(c.expiry_date) === "expiring_soon")
          .forEach((c) => issues.push({
            id: c.id,
            orgId: c.org_id,
            employeeId: c.employee_id,
            employeeName: c.employee?.name,
            type: c.type,
            title: c.title,
            description: c.description,
            issuedDate: c.issued_date,
            expiryDate: c.expiry_date,
            status: "expiring_soon",
            documentUrl: c.document_url,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
      } else {
        staffingStatus = "green";
      }
    }

    return {
      station,
      assignment: assignment ? {
        id: assignment.id,
        orgId: assignment.org_id,
        shiftId: assignment.shift_id,
        stationId: assignment.station_id,
        employeeId: assignment.employee_id,
        employeeName: assignment.employee?.name,
        assignmentDate: assignment.assignment_date,
        status: assignment.status,
        notes: assignment.notes,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
      } : undefined,
      employee: employeeId ? {
        id: employeeId,
        name: assignment?.employee?.name || "Unknown",
      } : undefined,
      complianceStatus: staffingStatus,
      complianceIssues: issues,
    };
  });
}

export async function getComplianceRadar(orgId: string): Promise<ComplianceItem[]> {
  if (!orgId) {
    console.error("getComplianceRadar: orgId is required");
    return [];
  }
  
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data, error } = await supabase
    .from("compliance_items")
    .select(`
      *,
      employee:employee_id(id, name)
    `)
    .eq("org_id", orgId)
    .lte("expiry_date", thirtyDaysFromNow.toISOString().slice(0, 10))
    .order("expiry_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch compliance items:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    employeeName: row.employee?.name,
    type: row.type,
    title: row.title,
    description: row.description,
    issuedDate: row.issued_date,
    expiryDate: row.expiry_date,
    status: calculateComplianceStatus(row.expiry_date),
    documentUrl: row.document_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getSafetyObservations(orgId: string, days: number = 7): Promise<SafetyObservation[]> {
  if (!orgId) {
    console.error("getSafetyObservations: orgId is required");
    return [];
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("safety_observations")
    .select(`
      *,
      station:station_id(name),
      reported_by:reported_by(name)
    `)
    .eq("org_id", orgId)
    .gte("observed_at", startDate.toISOString())
    .order("observed_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch safety observations:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    location: row.location,
    stationId: row.station_id,
    stationName: row.station?.name,
    reportedById: row.reported_by,
    reportedByName: row.reported_by?.name,
    status: row.status,
    actionId: row.action_id,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createSafetyObservation(observation: Partial<SafetyObservation>): Promise<SafetyObservation | null> {
  const { data, error } = await supabase
    .from("safety_observations")
    .insert({
      org_id: observation.orgId,
      title: observation.title,
      description: observation.description,
      severity: observation.severity || "low",
      location: observation.location,
      station_id: observation.stationId,
      reported_by: observation.reportedById,
      status: "open",
      observed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create safety observation:", error);
    return null;
  }

  return {
    id: data.id,
    orgId: data.org_id,
    title: data.title,
    description: data.description,
    severity: data.severity,
    location: data.location,
    stationId: data.station_id,
    status: data.status,
    observedAt: data.observed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getCockpitMetrics(orgId: string): Promise<CockpitMetrics> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [
    { count: openActions },
    { count: criticalActions },
    { count: totalStations },
    { count: expiringCompliance },
    { count: overdueCompliance },
    { count: safetyObservationsThisWeek },
    { count: openSafetyActions },
  ] = await Promise.all([
    supabase.from("actions").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
    supabase.from("actions").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open").eq("severity", "critical"),
    supabase.from("stations").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true),
    supabase.from("compliance_items").select("*", { count: "exact", head: true }).eq("org_id", orgId).lte("expiry_date", thirtyDaysFromNow.toISOString().slice(0, 10)).gte("expiry_date", today.toISOString().slice(0, 10)),
    supabase.from("compliance_items").select("*", { count: "exact", head: true }).eq("org_id", orgId).lt("expiry_date", today.toISOString().slice(0, 10)),
    supabase.from("safety_observations").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("observed_at", weekAgo.toISOString()),
    supabase.from("actions").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open").eq("domain", "safety"),
  ]);

  return {
    openActions: openActions || 0,
    criticalActions: criticalActions || 0,
    staffedStations: 0,
    totalStations: totalStations || 0,
    expiringCompliance: expiringCompliance || 0,
    overdueCompliance: overdueCompliance || 0,
    safetyObservationsThisWeek: safetyObservationsThisWeek || 0,
    openSafetyActions: openSafetyActions || 0,
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
