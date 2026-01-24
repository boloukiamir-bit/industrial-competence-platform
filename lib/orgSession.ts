import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type OrgSessionResult = {
  success: true;
  userId: string;
  orgId: string;
  role: string;
} | {
  success: false;
  error: string;
  status: 401 | 403;
};

export async function getOrgIdFromSession(request: NextRequest): Promise<OrgSessionResult> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { success: false, error: "Supabase not configured", status: 401 };
  }

  // Check for Authorization header first (for API-to-API calls)
  const authHeader = request.headers.get("Authorization");
  let accessToken: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7);
  }

  // Use createServerClient from @supabase/ssr to properly read cookies
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Read-only in route handlers; middleware handles cookie updates
      },
    },
  });

  // Get user from session (handles both cookie-based and token-based auth)
  let user;
  let authError;

  if (accessToken) {
    // If token provided via header, use it directly
    const result = await supabase.auth.getUser(accessToken);
    user = result.data.user;
    authError = result.error;
  } else {
    // Otherwise, use cookie-based session (createServerClient handles this)
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  }

  if (authError || !user) {
    return { success: false, error: "Invalid or expired session", status: 401 };
  }

  const userId = user.id;

  const preferredOrgId =
    cookieStore.get("current_org_id")?.value ||
    cookieStore.get("nadiplan_current_org")?.value;

  let membershipQuery = supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (preferredOrgId) {
    membershipQuery = membershipQuery.eq("org_id", preferredOrgId);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;

  if (membershipError) {
    return { success: false, error: "Failed to resolve organization", status: 403 };
  }

  if (!memberships || memberships.length === 0) {
    return { success: false, error: "No active organization membership", status: 403 };
  }

  return {
    success: true,
    userId,
    orgId: memberships[0].org_id,
    role: memberships[0].role,
  };
}

export function isAdminOrHr(role: string): boolean {
  return role === "admin" || role === "hr";
}
