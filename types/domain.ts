export type Employee = {
  id: string;
  name: string;
  employeeNumber: string;
  role: string;
  line: string;
  team: string;
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
