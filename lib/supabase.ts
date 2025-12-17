import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, validatePublicEnv } from "./env";

const env = getPublicEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function isSupabaseConfigured(): boolean {
  return validatePublicEnv().valid;
}
