import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isHrAdmin } from "@/lib/auth";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

/**
 * POST /api/debug/link-employee
 * Links the authenticated user to an employee record by email match within active_org_id.
 * 
 * Security:
 * - In production: requires HR admin role from memberships (tenant-scoped)
 * - In dev: allows all authenticated users (but still tenant-scoped)
 * - Tenant-scoped by active_org_id from profiles
 */
export async function POST() {
  const isProduction = process.env.NODE_ENV === "production";
  
  try {
    // Create server client with cookies
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    // Get user's profile to get active_org_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, active_org_id, email")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      const response = NextResponse.json({ error: "Profile not found" }, { status: 404 });
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    // Must have active_org_id for tenant scoping
    if (!profile.active_org_id) {
      const response = NextResponse.json(
        { error: "No active organization. Please select an organization first." },
        { status: 400 }
      );
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    // Authorization: In production, require HR admin role from memberships
    // In dev, allow all authenticated users (but still tenant-scoped)
    if (isProduction) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("org_id", profile.active_org_id)
        .eq("status", "active")
        .maybeSingle();

      if (!isHrAdmin(membership?.role)) {
        const response = NextResponse.json(
          { error: "Forbidden: HR admin role required in production" },
          { status: 403 }
        );
        applySupabaseCookies(response, pendingCookies);
        return response;
      }
    }

    const userEmail = user.email || profile.email;
    if (!userEmail) {
      const response = NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    // Use service_role client to bypass RLS for employee lookup and update
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Find employee: Priority A) user_id match, Fallback B) email match
    // Must be tenant-scoped by active_org_id
    let employee = null;
    
    // Priority A: Find by user_id
    const { data: employeeByUserId } = await supabaseAdmin
      .from("employees")
      .select("id, name, email, user_id")
      .eq("org_id", profile.active_org_id)
      .eq("is_active", true)
      .eq("user_id", user.id)
      .maybeSingle();

    if (employeeByUserId) {
      employee = employeeByUserId;
    } else {
      // Fallback B: Find by email
      const { data: employeeByEmail, error: employeeError } = await supabaseAdmin
        .from("employees")
        .select("id, name, email, user_id")
        .eq("org_id", profile.active_org_id)
        .eq("is_active", true)
        .eq("email", userEmail)
        .maybeSingle();

      if (employeeError) {
        console.error("Error finding employee:", employeeError);
        const response = NextResponse.json(
          { error: "Failed to query employees" },
          { status: 500 }
        );
        applySupabaseCookies(response, pendingCookies);
        return response;
      }

      if (!employeeByEmail) {
        const response = NextResponse.json(
          { 
            error: `No employee found with email "${userEmail}" in organization ${profile.active_org_id}`,
            suggestion: "Ensure the employee record exists and has a matching email address"
          },
          { status: 404 }
        );
        applySupabaseCookies(response, pendingCookies);
        return response;
      }

      employee = employeeByEmail;
    }

    // Check if already linked to a different user
    if (employee.user_id && employee.user_id !== user.id) {
      const response = NextResponse.json(
        { 
          error: `Employee is already linked to a different user (${employee.user_id})`,
          employeeId: employee.id,
          employeeName: employee.name
        },
        { status: 409 }
      );
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    // Check if already linked to this user
    if (employee.user_id === user.id) {
      const response = NextResponse.json(
        { 
          message: "Employee is already linked to your account",
          employeeId: employee.id,
          employeeName: employee.name
        },
        { status: 200 }
      );
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    // Link employee to user (set user_id if null)
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ user_id: user.id })
      .eq("id", employee.id);

    if (updateError) {
      console.error("Error linking employee:", updateError);
      const response = NextResponse.json(
        { error: "Failed to link employee" },
        { status: 500 }
      );
      applySupabaseCookies(response, pendingCookies);
      return response;
    }

    const response = NextResponse.json({
      message: "Successfully linked employee to your account",
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email
    });
    applySupabaseCookies(response, pendingCookies);
    return response;
  } catch (error) {
    console.error("Error in link-employee:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
