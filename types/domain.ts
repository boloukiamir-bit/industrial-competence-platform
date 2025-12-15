export type Employee = {
  id: string;
  name: string;
  employeeNumber: string;
  role: string;
  line: string;
  team: string;
  employmentType: 'permanent' | 'temporary';
  startDate?: string;
  contractEndDate?: string;
  managerId?: string;
  isActive: boolean;
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
  category: PersonEventCategory;
  title: string;
  description?: string;
  dueDate: string;
  completedDate?: string;
  recurrence?: string;
  ownerManagerId?: string;
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
  assignedDate: string;
  returnDate?: string;
  status: 'assigned' | 'returned' | 'lost';
};

export type Document = {
  id: string;
  employeeId?: string;
  title: string;
  type: 'contract' | 'handbook' | 'policy' | 'certificate' | 'other';
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
