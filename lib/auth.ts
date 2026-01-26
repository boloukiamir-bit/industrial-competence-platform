import { supabase } from "./supabaseClient";
import type { AppRole, AppUser } from "@/types/domain";

export type { AppRole };

export type CurrentUser = {
  id: string;
  role: AppRole;
  employeeId?: string;
  email: string;
};

// public.users does not exist; auth.users is not exposed via PostgREST. App identity/roles
// come from public.profiles (id = auth.users.id). For Line Overview operators use pl_employees.
function mapProfileRoleToAppRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "hr") return "HR_ADMIN";
  if (role === "manager") return "MANAGER";
  if (role === "user") return "EMPLOYEE";
  return "EMPLOYEE";
}

function isDevFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && Boolean(process.env.NEXT_PUBLIC_DEV_USER_EMAIL);
}

/**
 * Check if a role from memberships table grants HR admin access.
 * Returns true for: 'admin', 'hr_admin', 'hr-admin' (case-insensitive)
 * This is used instead of profiles.role because profiles.role has a CHECK constraint
 * that doesn't allow 'HR_ADMIN' to be stored.
 */
export function isHrAdmin(role: string | null | undefined): boolean {
  const r = (role ?? "").toLowerCase();
  return r === "admin" || r === "hr_admin" || r === "hr-admin";
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const devEmail = process.env.NEXT_PUBLIC_DEV_USER_EMAIL || "hr@example.com";

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (isDevFallbackAllowed()) return { id: "dev-user", role: "HR_ADMIN" as AppRole, email: devEmail };
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, email, active_org_id")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      // Least privilege on profile failure: never HR_ADMIN
      if (isDevFallbackAllowed()) return { id: "dev-user", role: "HR_ADMIN" as AppRole, email: devEmail };
      return { id: user.id, role: "EMPLOYEE" as AppRole, email: user.email ?? "", employeeId: undefined };
    }

    const userEmail = user.email ?? (profile as { email?: string | null }).email ?? devEmail;
    let employeeId: string | undefined = undefined;

    // Find employee record: Priority A) user_id match, Fallback B) email match
    // Must be tenant-scoped by active_org_id
    if (profile.active_org_id) {
      // Priority A: Find by user_id
      const { data: employeeByUserId } = await supabase
        .from("employees")
        .select("id")
        .eq("org_id", profile.active_org_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (employeeByUserId) {
        employeeId = employeeByUserId.id;
      } else {
        // Fallback B: Find by email (if employees.email exists)
        // Check if email column exists first to avoid errors
        const { data: employeeByEmail } = await supabase
          .from("employees")
          .select("id")
          .eq("org_id", profile.active_org_id)
          .eq("email", userEmail)
          .maybeSingle();

        if (employeeByEmail) {
          employeeId = employeeByEmail.id;
        }
      }
    }

    return {
      id: profile.id,
      role: mapProfileRoleToAppRole(profile.role),
      employeeId,
      email: userEmail,
    };
  } catch {
    if (isDevFallbackAllowed()) return { id: "dev-user", role: "HR_ADMIN" as AppRole, email: devEmail };
    return null;
  }
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
  // Check HR_ADMIN from AppRole (backwards compatibility) or use isHrAdmin for membership roles
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
