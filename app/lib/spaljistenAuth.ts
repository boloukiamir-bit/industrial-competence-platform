import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSpaliDevMode, SPALJISTEN_ORG_ID } from "@/lib/spaliDevMode";

export async function verifySpaljistenAccess(): Promise<{ authorized: boolean; userId?: string; email?: string; error?: string }> {
  const isDevMode = getSpaliDevMode();
  
  if (isDevMode) {
    return { authorized: true };
  }
  
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { authorized: false, error: "Supabase not configured" };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { authorized: false, error: "Not authenticated" };
    }

    // PRODUCTION: Check DB membership for Spaljisten org
    // For now, deny access when dev mode is false (requires DB membership check implementation)
    return { 
      authorized: false, 
      userId: user.id, 
      email: user.email || undefined, 
      error: "No org assigned - Spaljisten membership required" 
    };
  } catch {
    return { authorized: false, error: "Authorization check failed" };
  }
}

export { SPALJISTEN_ORG_ID };
