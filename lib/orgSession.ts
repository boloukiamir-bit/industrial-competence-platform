import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  const authHeader = request.headers.get("Authorization");
  let accessToken: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7);
  }

  if (!accessToken) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Try standard cookie name first
    let sbAccessToken = cookieStore.get("sb-access-token")?.value;
    
    // Try project-specific cookie (sb-<project-ref>-auth-token)
    if (!sbAccessToken) {
      const authCookie = allCookies.find(c => 
        c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
      );
      if (authCookie?.value) {
        try {
          const parsed = JSON.parse(authCookie.value);
          sbAccessToken = parsed.access_token || parsed[0]?.access_token;
        } catch {
          sbAccessToken = authCookie.value;
        }
      }
    }
    
    // Also try base64 encoded session cookie format
    if (!sbAccessToken) {
      const sessionCookie = allCookies.find(c => 
        c.name.includes("supabase") || (c.name.startsWith("sb-") && c.name.includes("auth"))
      );
      if (sessionCookie?.value) {
        try {
          const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          sbAccessToken = parsed.access_token;
        } catch {
          // Not base64 encoded
        }
      }
    }
    
    if (sbAccessToken) {
      accessToken = sbAccessToken;
    }
  }

  if (!accessToken) {
    return { success: false, error: "Not authenticated - access token required", status: 401 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return { success: false, error: "Invalid or expired session", status: 401 };
  }

  const userId = user.id;
  console.log("[orgSession] Authenticated user ID:", userId, "email:", user.email);

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get("current_org_id")?.value;

  // Query memberships from Supabase (not local pg)
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
  console.log("[orgSession] Membership query result:", memberships?.length || 0, "rows", membershipError?.message || "");

  if (!memberships || memberships.length === 0) {
    // Fallback: try without preferred org filter
    if (preferredOrgId) {
      const { data: fallbackMemberships } = await supabase
        .from("memberships")
        .select("org_id, role")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);

      if (fallbackMemberships && fallbackMemberships.length > 0) {
        return {
          success: true,
          userId,
          orgId: fallbackMemberships[0].org_id,
          role: fallbackMemberships[0].role,
        };
      }
    }

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
