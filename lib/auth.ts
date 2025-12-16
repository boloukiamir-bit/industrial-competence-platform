import { supabase } from "./supabaseClient";
import type { AppRole, AppUser } from "@/types/domain";

export type { AppRole };

export type CurrentUser = {
  id: string;
  role: AppRole;
  employeeId?: string;
  email: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const devEmail = process.env.NEXT_PUBLIC_DEV_USER_EMAIL || "hr@example.com";
  
  const { data, error } = await supabase
    .from("users")
    .select("id, employee_id, email, role")
    .eq("email", devEmail)
    .single();

  if (error || !data) {
    return {
      id: "dev-user",
      role: "HR_ADMIN" as AppRole,
      email: devEmail,
    };
  }

  return {
    id: data.id,
    role: data.role as AppRole,
    employeeId: data.employee_id || undefined,
    email: data.email,
  };
}

export function requireRole(
  user: { role: AppRole } | null,
  allowed: AppRole[]
): void {
  if (!user) {
    throw new Error("Unauthorized: User not authenticated");
  }
  if (!allowed.includes(user.role)) {
    throw new Error(`Forbidden: Role ${user.role} not allowed`);
  }
}

export function canAccessEmployee(
  user: CurrentUser | null,
  employeeId: string,
  managedEmployeeIds: string[]
): boolean {
  if (!user) return false;
  if (user.role === "HR_ADMIN") return true;
  if (user.role === "MANAGER") {
    return managedEmployeeIds.includes(employeeId);
  }
  if (user.role === "EMPLOYEE") {
    return user.employeeId === employeeId;
  }
  return false;
}

export async function getManagedEmployeeIds(managerId: string): Promise<string[]> {
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("manager_id", managerId)
    .eq("is_active", true);

  return (data || []).map((e) => e.id);
}
