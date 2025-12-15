import { supabase } from "@/lib/supabaseClient";
import type { Employee, EmployeeSkill, PersonEvent, Document, EmployeeEquipment } from "@/types/domain";

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*, manager:manager_id(name)")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    employeeNumber: row.employee_number,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    role: row.role,
    line: row.line,
    team: row.team,
    employmentType: row.employment_type,
    startDate: row.start_date,
    contractEndDate: row.contract_end_date,
    managerId: row.manager_id,
    managerName: row.manager?.name,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    country: row.country,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("*, manager:manager_id(name)")
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

export async function getEmployeeSkills(employeeId: string): Promise<EmployeeSkill[]> {
  const { data, error } = await supabase
    .from("employee_skills")
    .select("*, skills(*)")
    .eq("employee_id", employeeId);

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
