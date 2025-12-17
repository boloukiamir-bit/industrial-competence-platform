import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, validatePublicEnv } from "./env";

let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  const env = getPublicEnv();
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

export const supabase: SupabaseClient = createSupabaseClient();

export function isSupabaseReady(): boolean {
  const validation = validatePublicEnv();
  return validation.valid;
}
