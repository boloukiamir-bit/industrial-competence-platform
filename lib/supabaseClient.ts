import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getEnvVar(name: string): string {
  if (typeof window !== 'undefined') {
    // Client-side: access from window or process.env (inlined at build)
    return (process.env as Record<string, string | undefined>)[name] || "";
  }
  // Server-side
  return process.env[name] || "";
}

const supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

function createSupabaseClient(): SupabaseClient {
  const hasCredentials = supabaseUrl && supabaseAnonKey;
  
  if (!hasCredentials && typeof window !== 'undefined') {
    console.error(
      "Supabase environment variables not set. " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.",
      { url: supabaseUrl ? "set" : "missing", key: supabaseAnonKey ? "set" : "missing" }
    );
  }
  
  // Use actual values - fail early if not configured
  const url = supabaseUrl || "https://placeholder.supabase.co";
  const key = supabaseAnonKey || "placeholder-key";
  
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
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

export function isSupabaseReady(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
