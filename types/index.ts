export interface User {
  id: string;
  email: string;
  name?: string;
  role?: "admin" | "manager" | "employee";
  createdAt?: string;
}

export interface Competency {
  id: string;
  name: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  requiredForRoles?: string[];
}

export interface Certification {
  id: string;
  name: string;
  issuingOrganization: string;
  validFrom: string;
  validUntil?: string;
  status: "valid" | "expiring" | "expired";
}

export interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  duration: string | null;
  competencies: string[] | null;
  status: "draft" | "active" | "archived";
}

export interface EmployeeCompetency {
  employeeId: string;
  competencyId: string;
  level: number;
  lastAssessed: string;
  certifications?: string[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
