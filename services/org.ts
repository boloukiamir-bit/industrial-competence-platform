import { supabase } from "@/lib/supabaseClient";
import type { OrgUnit, Employee, OrgUnitType } from "@/types/domain";

export async function getOrgUnits(orgId?: string): Promise<OrgUnit[]> {
  let query = supabase
    .from("org_units")
    .select("*")
    .order("name");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching org units:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    parentId: row.parent_id || undefined,
    type: row.type as OrgUnitType | undefined,
    managerEmployeeId: row.manager_employee_id || undefined,
    managerName: undefined,
    createdAt: row.created_at,
  }));
}

export async function getOrgTree(orgId?: string): Promise<OrgUnit[]> {
  let unitsQuery = supabase.from("org_units").select("*").order("name");
  let employeesQuery = supabase.from("employees").select("id, name, role").eq("is_active", true);
  
  if (orgId) {
    unitsQuery = unitsQuery.eq("org_id", orgId);
    employeesQuery = employeesQuery.eq("org_id", orgId);
  }

  const [unitsResult, employeesResult] = await Promise.all([unitsQuery, employeesQuery]);

  if (unitsResult.error) {
    console.error("Error fetching org units:", unitsResult.error);
    return [];
  }

  const units: OrgUnit[] = (unitsResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    parentId: row.parent_id || undefined,
    type: row.type as OrgUnitType | undefined,
    managerEmployeeId: row.manager_employee_id || undefined,
    managerName: undefined,
    createdAt: row.created_at,
    children: [],
    employees: [],
    employeeCount: 0,
  }));

  const employees: Employee[] = (employeesResult.data || []).map((row) => ({
    id: row.id,
    name: row.name || "",
    employeeNumber: "",
    role: row.role || "",
    line: "",
    team: "",
    employmentType: "permanent",
    orgUnitId: undefined,
    isActive: true,
  }));

  const unitMap = new Map<string, OrgUnit>();
  units.forEach((u) => unitMap.set(u.id, u));

  employees.forEach((e) => {
    if (e.orgUnitId) {
      const unit = unitMap.get(e.orgUnitId);
      if (unit) {
        unit.employees = unit.employees || [];
        unit.employees.push(e);
        unit.employeeCount = (unit.employeeCount || 0) + 1;
      }
    }
  });

  const rootUnits: OrgUnit[] = [];

  units.forEach((unit) => {
    if (unit.parentId) {
      const parent = unitMap.get(unit.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(unit);
      } else {
        rootUnits.push(unit);
      }
    } else {
      rootUnits.push(unit);
    }
  });

  function aggregateEmployeeCount(unit: OrgUnit): number {
    let count = unit.employeeCount || 0;
    if (unit.children) {
      for (const child of unit.children) {
        count += aggregateEmployeeCount(child);
      }
    }
    unit.employeeCount = count;
    return count;
  }

  rootUnits.forEach(aggregateEmployeeCount);

  return rootUnits;
}

export async function getOrgUnitById(id: string): Promise<OrgUnit | null> {
  const { data, error } = await supabase
    .from("org_units")
    .select("*, manager:manager_employee_id(name)")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching org unit:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    code: data.code || undefined,
    parentId: data.parent_id || undefined,
    type: data.type as OrgUnitType | undefined,
    managerEmployeeId: data.manager_employee_id || undefined,
    managerName: data.manager?.name || undefined,
    createdAt: data.created_at,
  };
}

export type CreateOrgUnitPayload = {
  name: string;
  code?: string;
  parentId?: string;
  type?: OrgUnitType;
  managerEmployeeId?: string;
  orgId: string;
};

export async function createOrgUnit(payload: CreateOrgUnitPayload): Promise<OrgUnit | null> {
  const { data, error } = await supabase
    .from("org_units")
    .insert({
      name: payload.name,
      code: payload.code || null,
      parent_id: payload.parentId || null,
      type: payload.type || null,
      manager_employee_id: payload.managerEmployeeId || null,
      org_id: payload.orgId,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating org unit:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    code: data.code || undefined,
    parentId: data.parent_id || undefined,
    type: data.type as OrgUnitType | undefined,
    managerEmployeeId: data.manager_employee_id || undefined,
    createdAt: data.created_at,
  };
}

export async function getEmployeesByOrgUnit(orgUnitId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("org_unit_id", orgUnitId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Error fetching employees by org unit:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name || "",
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    employeeNumber: row.employee_number || "",
    email: row.email || undefined,
    phone: row.phone || undefined,
    dateOfBirth: row.date_of_birth || undefined,
    role: row.role || "",
    line: row.line || "",
    team: row.team || "",
    employmentType: row.employment_type || "permanent",
    startDate: row.start_date || undefined,
    contractEndDate: row.contract_end_date || undefined,
    managerId: row.manager_id || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    postalCode: row.postal_code || undefined,
    country: row.country || "Sweden",
    orgUnitId: row.org_unit_id || undefined,
    isActive: row.is_active ?? true,
  }));
}
