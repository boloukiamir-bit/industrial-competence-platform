import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/**
 * Admin Bootstrap Route
 * 
 * First user to call this becomes admin, then bootstrap is permanently disabled.
 * Requires authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const env = getPublicEnv();
    
    // Get the service role key (server-side only)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error: service role key not set" },
        { status: 500 }
      );
    }

    // Create admin client with service role
    const adminClient = createClient(env.supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create regular client for auth verification
    const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: No valid session token" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify the user's session
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid session" },
        { status: 401 }
      );
    }

    // Ensure profiles table exists
    const createTableResult = await adminClient.rpc('create_profiles_table_if_not_exists');
    
    // If RPC doesn't exist, try to create the table directly
    if (createTableResult.error) {
      // Try direct table creation via raw SQL
      await adminClient.from('profiles').select('id').limit(1);
    }

    // Check if any profiles exist
    const { data: existingProfiles, error: countError } = await adminClient
      .from("profiles")
      .select("id")
      .limit(1);

    if (countError) {
      // Table might not exist - create it
      return NextResponse.json(
        { 
          error: "Profiles table not ready. Please create the profiles table in Supabase.",
          details: "Run the SQL migration to create the profiles table."
        },
        { status: 500 }
      );
    }

    // If profiles already exist, bootstrap is disabled
    if (existingProfiles && existingProfiles.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Bootstrap disabled: admin user already exists" 
        },
        { status: 403 }
      );
    }

    // Create the admin profile for the current user
    const { error: insertError } = await adminClient
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        role: "admin",
      });

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create admin profile: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin bootstrap complete. You are now the admin.",
      user: {
        id: user.id,
        email: user.email,
        role: "admin",
      },
    });

  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bootstrap failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to run bootstrap." },
    { status: 405 }
  );
}
