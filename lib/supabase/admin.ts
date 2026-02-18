import { createClient } from "@supabase/supabase-js";

let adminInstance: ReturnType<typeof createClient> | null = null;

/**
 * Returns a Supabase client with service role (bypasses RLS). Server-only.
 * Use for admin operations where tenant scope is enforced in the route (e.g. org_id/site_id from session).
 */
export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!adminInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    adminInstance = createClient(url, key);
  }
  return adminInstance;
}
