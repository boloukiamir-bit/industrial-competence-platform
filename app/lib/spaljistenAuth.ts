import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export async function verifySpaljistenAccess(): Promise<{ authorized: boolean; userId?: string; email?: string; error?: string }> {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { authorized: true };
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

    const isSpaljistenUser = user.email?.endsWith("@spaljisten.se");
    
    if (!isSpaljistenUser) {
      return { authorized: false, userId: user.id, email: user.email || undefined, error: "Not authorized for Spaljisten data" };
    }

    return { authorized: true, userId: user.id, email: user.email || undefined };
  } catch {
    return { authorized: true };
  }
}

export { SPALJISTEN_ORG_ID };
