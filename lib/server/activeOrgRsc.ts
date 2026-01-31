/**
 * Resolve active org id for Server Components (RSC).
 * Uses cookies + Supabase auth; no request object.
 * Returns null if not authenticated or no membership.
 */
export async function getActiveOrgIdForRSC(): Promise<string | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");

  const { supabase } = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.active_org_id) return null;
  return profile.active_org_id;
}
