import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import pool from "@/lib/pgClient";

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

  let membershipQuery: string;
  let membershipParams: (string | undefined)[];

  if (preferredOrgId) {
    membershipQuery = `
      SELECT org_id, role 
      FROM memberships 
      WHERE user_id = $1 AND status = 'active' AND org_id = $2
      LIMIT 1
    `;
    membershipParams = [userId, preferredOrgId];
  } else {
    membershipQuery = `
      SELECT org_id, role 
      FROM memberships 
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `;
    membershipParams = [userId];
  }

  const membershipResult = await pool.query(membershipQuery, membershipParams);
  console.log("[orgSession] Membership query result:", membershipResult.rows.length, "rows");

  if (membershipResult.rows.length === 0) {
    if (preferredOrgId) {
      const fallbackResult = await pool.query(
        `SELECT org_id, role FROM memberships WHERE user_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
        [userId]
      );
      
      if (fallbackResult.rows.length === 0) {
        return { success: false, error: "No active organization membership", status: 403 };
      }
      
      return {
        success: true,
        userId,
        orgId: fallbackResult.rows[0].org_id,
        role: fallbackResult.rows[0].role,
      };
    }
    
    return { success: false, error: "No active organization membership", status: 403 };
  }

  return {
    success: true,
    userId,
    orgId: membershipResult.rows[0].org_id,
    role: membershipResult.rows[0].role,
  };
}

export function isAdminOrHr(role: string): boolean {
  return role === "admin" || role === "hr";
}
