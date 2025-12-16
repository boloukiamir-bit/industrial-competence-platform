export type Employee = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  employeeNumber: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  role: string;
  line: string;
  team: string;
  employmentType: 'permanent' | 'temporary' | 'consultant';
  startDate?: string;
  contractEndDate?: string;
  managerId?: string;
  managerName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  orgUnitId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Skill = {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
};

export type CompetenceLevel = {
  value: 0 | 1 | 2 | 3 | 4;
  label: string;
  description: string;
};

export type EmployeeSkill = {
  employeeId: string;
  skillId: string;
  level: CompetenceLevel["value"];
  skillName?: string;
  skillCode?: string;
  skillCategory?: string;
};

export type RoleSkillRequirement = {
  id: string;
  role: string;
  line: string;
  skillId: string;
  requiredLevel: number;
  requiredHeadcount: number;
};

export type PersonEventCategory =
  | "contract"
  | "medical_check"
  | "training"
  | "onboarding"
  | "offboarding"
  | "work_env_delegation"
  | "equipment";

export type PersonEventStatus = "upcoming" | "due_soon" | "overdue" | "completed";

export type PersonEvent = {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  category: PersonEventCategory;
  title: string;
  description?: string;
  dueDate: string;
  completedDate?: string;
  recurrence?: string;
  ownerManagerId?: string;
  ownerManagerEmail?: string;
  status: PersonEventStatus;
  notes?: string;
};

export type Equipment = {
  id: string;
  name: string;
  serialNumber: string;
  category?: string;
  requiredForRole?: string;
};

export type EmployeeEquipment = {
  id: string;
  employeeId: string;
  equipmentId: string;
  equipmentName?: string;
  serialNumber?: string;
  assignedDate: string;
  returnDate?: string;
  status: 'assigned' | 'returned' | 'lost';
};

export type DocumentType = 
  | 'contract' 
  | 'handbook' 
  | 'policy' 
  | 'certificate' 
  | 'employee_handbook' 
  | 'manager_handbook' 
  | 'review_protocol' 
  | 'other';

export type Document = {
  id: string;
  employeeId?: string;
  title: string;
  type: DocumentType;
  url: string;
  createdAt: string;
  validTo?: string;
};

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy?: string;
  isPinned: boolean;
};

export type GapItem = {
  line: string;
  team: string | null;
  role: string;
  skillName: string;
  skillId: string;
  requiredLevel: number;
  currentAvgLevel: number;
  missingCount: number;
};

export type ReviewTemplate = {
  id: string;
  name: string;
  description?: string;
  audience: 'employee' | 'manager' | 'both';
  isActive: boolean;
  createdAt: string;
};

export type ReviewGoal = {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'completed';
};

export type EmployeeReview = {
  id: string;
  employeeId: string;
  managerId?: string;
  managerName?: string;
  templateId?: string;
  templateName?: string;
  reviewDate: string;
  periodStart?: string;
  periodEnd?: string;
  overallRating?: number;
  summary?: string;
  goals?: ReviewGoal[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type SalaryRecord = {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  salaryAmountSek: number;
  salaryType: 'monthly' | 'hourly';
  positionTitle?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
};

export type SalaryRevision = {
  id: string;
  employeeId: string;
  revisionDate: string;
  previousSalarySek: number;
  newSalarySek: number;
  salaryType: 'monthly' | 'hourly';
  reason?: string;
  decidedByManagerId?: string;
  decidedByManagerName?: string;
  documentId?: string;
  createdAt: string;
};

export type GdprAccessLog = {
  id: string;
  employeeId: string;
  accessedByUserId?: string;
  accessedAt: string;
  accessType: 'view_profile' | 'export_data' | 'download_document' | 'update_profile' | 'delete_profile';
  metadata?: Record<string, unknown>;
};

export type CertificateInfo = {
  employeeId: string;
  employeeName: string;
  line: string;
  team: string;
  skillId: string;
  skillName: string;
  skillCode: string;
  currentLevel: number;
  latestTrainingDate?: string;
  nextDueDate?: string;
};

export type OneToOneMeetingStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type OneToOneMeeting = {
  id: string;
  employeeId: string;
  employeeName?: string;
  managerId?: string;
  managerName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  status: OneToOneMeetingStatus;
  templateName?: string;
  sharedAgenda?: string;
  employeeNotesPrivate?: string;
  managerNotesPrivate?: string;
  createdAt: string;
  updatedAt?: string;
};

export type OneToOneActionOwner = 'employee' | 'manager';

export type OneToOneAction = {
  id: string;
  meetingId: string;
  description: string;
  ownerType: OneToOneActionOwner;
  isCompleted: boolean;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
};

export type EmailOutboxStatus = 'pending' | 'sent' | 'failed';

export type EmailOutbox = {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  createdAt: string;
  sentAt?: string;
  status: EmailOutboxStatus;
  errorMessage?: string;
  meta?: Record<string, unknown>;
};

export type OrgUnitType = 'company' | 'site' | 'department' | 'team' | 'division' | 'unit';

export type OrgUnit = {
  id: string;
  name: string;
  code?: string;
  parentId?: string;
  type?: OrgUnitType;
  managerEmployeeId?: string;
  managerName?: string;
  createdAt: string;
  children?: OrgUnit[];
  employees?: Employee[];
  employeeCount?: number;
};

export type AbsenceType = 'sick' | 'vacation' | 'parental' | 'leave' | 'other';

export type Absence = {
  id: string;
  employeeId: string;
  type: AbsenceType;
  fromDate: string;
  toDate: string;
  notes?: string;
  createdAt: string;
};

export type AppRole = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type AppUser = {
  id: string;
  employeeId?: string;
  email: string;
  role: AppRole;
  createdAt: string;
};

export type HRAnalytics = {
  totalHeadcount: number;
  headcountByOrgUnit: { orgUnitName: string; count: number; permanent: number; temporary: number; consultant: number }[];
  headcountByEmploymentType: { type: string; count: number }[];
  sickLeaveRatio: number;
  temporaryContractsEndingSoon: number;
  temporaryContractsEndingList: { id: string; name: string; contractEndDate: string; role: string }[];
  criticalEventsCount: { category: string; count: number }[];
  criticalEventsByStatus: { overdue: number; dueSoon: number };
  skillDistribution: { skillName: string; levels: number[] }[];
  riskIndexByUnit: { unitName: string; headcount: number; overdueCount: number; dueSoonCount: number; riskIndex: number }[];
  absencesAvailable: boolean;
};

export type HRWorkflowTemplateId = 
  | 'sick_leave' 
  | 'rehab' 
  | 'parental_leave' 
  | 'reboarding' 
  | 'onboarding' 
  | 'offboarding';

export type HRWorkflowStatus = 'active' | 'completed' | 'cancelled';

export type HRWorkflowStep = {
  id: string;
  title: string;
  description?: string;
  daysFromStart: number;
  responsibleRole: 'hr' | 'manager' | 'employee';
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
};

export type HRWorkflowTemplate = {
  id: HRWorkflowTemplateId;
  name: string;
  description: string;
  category: 'leave' | 'lifecycle' | 'health';
  defaultSteps: Omit<HRWorkflowStep, 'id' | 'isCompleted' | 'completedAt' | 'completedBy' | 'notes'>[];
};

export type HRWorkflowInstance = {
  id: string;
  templateId: HRWorkflowTemplateId;
  templateName: string;
  employeeId: string;
  employeeName?: string;
  startedAt: string;
  dueDate?: string;
  status: HRWorkflowStatus;
  steps: HRWorkflowStep[];
  createdBy?: string;
  completedAt?: string;
  notes?: string;
};

export type HRAnalyticsV2 = HRAnalytics & {
  attritionRisk: { 
    highrisk: number; 
    mediumRisk: number; 
    employees: { id: string; name: string; riskLevel: 'high' | 'medium'; factors: string[] }[];
  };
  tenureBands: { band: string; count: number }[];
  avgTenureYears: number;
  openWorkflowsByTemplate: { templateId: string; templateName: string; count: number }[];
  skillGapSummary: { criticalGaps: number; trainingNeeded: number; wellStaffed: number };
};
