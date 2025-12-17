import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function createSupabaseClient(): SupabaseClient {
  const hasCredentials = supabaseUrl && supabaseAnonKey;
  
  if (!hasCredentials) {
    console.warn(
      "Supabase environment variables not set. " +
      "Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.",
      { urlSet: !!supabaseUrl, keySet: !!supabaseAnonKey }
    );
  }
  
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co", 
    supabaseAnonKey || "placeholder",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

export const supabase: SupabaseClient = createSupabaseClient();

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}
