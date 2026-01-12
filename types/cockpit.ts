export type ActionDomain = 'ops' | 'people' | 'safety';
export type ActionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ActionStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export type Action = {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  domain: ActionDomain;
  severity: ActionSeverity;
  status: ActionStatus;
  dueDate?: string;
  completedDate?: string;
  ownerId?: string;
  ownerName?: string;
  relatedEmployeeId?: string;
  relatedEmployeeName?: string;
  relatedStationId?: string;
  relatedStationName?: string;
  impact?: string;
  createdAt: string;
  updatedAt: string;
};

export type Station = {
  id: string;
  orgId: string;
  name: string;
  code?: string;
  line?: string;
  area?: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Shift = {
  id: string;
  orgId: string;
  name: string;
  code?: string;
  startTime?: string;
  endTime?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShiftAssignment = {
  id: string;
  orgId: string;
  shiftId: string;
  stationId: string;
  employeeId?: string;
  employeeName?: string;
  assignmentDate: string;
  status: 'assigned' | 'unassigned' | 'absent';
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing';

export type ComplianceItem = {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName?: string;
  type: string;
  title: string;
  description?: string;
  issuedDate?: string;
  expiryDate?: string;
  status: ComplianceStatus;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type SafetyObservationSeverity = 'low' | 'medium' | 'high';
export type SafetyObservationStatus = 'open' | 'action_created' | 'resolved';

export type SafetyObservation = {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  severity: SafetyObservationSeverity;
  location?: string;
  stationId?: string;
  stationName?: string;
  reportedById?: string;
  reportedByName?: string;
  status: SafetyObservationStatus;
  actionId?: string;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffingStatus = 'green' | 'yellow' | 'red';

export type StationStaffingCard = {
  station: Station;
  assignment?: ShiftAssignment;
  employee?: {
    id: string;
    name: string;
  };
  complianceStatus: StaffingStatus;
  complianceIssues: ComplianceItem[];
};

export type CockpitMetrics = {
  openActions: number;
  criticalActions: number;
  staffedStations: number;
  totalStations: number;
  expiringCompliance: number;
  overdueCompliance: number;
  safetyObservationsThisWeek: number;
  openSafetyActions: number;
};

export type PlanVsActual = {
  label: string;
  plan: number;
  actual: number;
};

export type PriorityItem = {
  id: string;
  type: 'staffing' | 'compliance' | 'safety';
  title: string;
  impact: string;
  severity: 'high' | 'critical';
  linkedEntity?: {
    type: 'station' | 'employee';
    id: string;
    name: string;
  };
  actionId?: string;
};

export type ActivityLogEntry = {
  id: string;
  actionId: string;
  type: 'created' | 'updated' | 'reassigned' | 'due_date_changed' | 'completed';
  description: string;
  userId?: string;
  userName?: string;
  createdAt: string;
};

export type EmployeeSuggestion = {
  employee: {
    id: string;
    name: string;
  };
  score: number;
  complianceValid: boolean;
  skillMatch: number;
  availability: 'available' | 'busy' | 'off';
};

export type HandoverItem = {
  id: string;
  type: 'open_loop' | 'decision' | 'risk';
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high';
  createdAt: string;
};
