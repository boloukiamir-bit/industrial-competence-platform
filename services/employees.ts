import { supabase } from "@/lib/supabaseClient";
import type { Employee, EmployeeSkill, PersonEvent, Document, EmployeeEquipment } from "@/types/domain";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";

type EmployeeRow = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  employee_number: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  role: string | null;
  line: string | null;
  team: string | null;
  employment_type: string | null;
  start_date: string | null;
  contract_end_date: string | null;
  manager_id: string | null;
  manager?: { name: string | null } | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export async function getEmployees(orgId: string): Promise<Employee[]> {
  if (!orgId) return [];
  const { data, error } = await employeesBaseQuery(
    supabase,
    orgId,
    "*, manager:manager_id(name)"
  ).order("name");

  if (error) throw new Error(error.message);

  const rows = (data || []) as unknown as EmployeeRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    employeeNumber: row.employee_number,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    role: row.role ?? "",
    line: row.line ?? "",
    team: row.team ?? "",
    employmentType: (row.employment_type ?? "permanent") as "permanent" | "temporary" | "consultant",
    startDate: row.start_date ?? undefined,
    contractEndDate: row.contract_end_date ?? undefined,
    managerId: row.manager_id ?? undefined,
    managerName: row.manager?.name ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    postalCode: row.postal_code ?? undefined,
    country: row.country ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }));
}


export async function getEmployeeById(id: string, orgId: string): Promise<Employee | null> {
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("employees")
    .select("*, manager:manager_id(name)")
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (error) return null;

  return {
    id: data.id,
    name: data.name,
    firstName: data.first_name,
    lastName: data.last_name,
    employeeNumber: data.employee_number,
    email: data.email,
    phone: data.phone,
    dateOfBirth: data.date_of_birth,
    role: data.role,
    line: data.line,
    team: data.team,
    employmentType: data.employment_type,
    startDate: data.start_date,
    contractEndDate: data.contract_end_date,
    managerId: data.manager_id,
    managerName: data.manager?.name,
    address: data.address,
    city: data.city,
    postalCode: data.postal_code,
    country: data.country,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getEmployeeSkills(employeeId: string, orgId?: string): Promise<EmployeeSkill[]> {
  let effectiveOrgId = orgId;
  if (!effectiveOrgId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return [];
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.active_org_id) return [];
    effectiveOrgId = profile.active_org_id;
  }

  const { data, error } = await supabase
    .from("employee_skills")
    .select("*, skills(*)")
    .eq("employee_id", employeeId)
    .eq("skills.org_id", effectiveOrgId);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    employeeId: row.employee_id,
    skillId: row.skill_id,
    level: row.level,
    skillName: row.skills?.name,
    skillCode: row.skills?.code,
    skillCategory: row.skills?.category,
  }));
}

export async function getEmployeeEvents(employeeId: string): Promise<PersonEvent[]> {
  const { data, error } = await supabase
    .from("person_events")
    .select("*")
    .eq("employee_id", employeeId)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    category: row.category,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    recurrence: row.recurrence,
    ownerManagerId: row.owner_manager_id,
    status: row.status,
    notes: row.notes,
  }));
}

export async function getEmployeeDocuments(employeeId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    type: row.type,
    url: row.url,
    createdAt: row.created_at,
    validTo: row.valid_to,
  }));
}

export async function getEmployeeEquipment(employeeId: string): Promise<EmployeeEquipment[]> {
  const { data, error } = await supabase
    .from("employee_equipment")
    .select("*, equipment(*)")
    .eq("employee_id", employeeId)
    .eq("status", "assigned");

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment?.name,
    serialNumber: row.equipment?.serial_number,
    assignedDate: row.assigned_date,
    returnDate: row.return_date,
    status: row.status,
  }));
}
