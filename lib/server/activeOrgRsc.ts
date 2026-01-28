/**
 * Resolve active org id for Server Components (RSC).
 * Uses cookies + Supabase auth; no request object.
 * Returns null if not authenticated or no membership.
 */
export async function getActiveOrgIdForRSC(): Promise<string | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const { cookies } = await import("next/headers");

  const { supabase } = await createSupabaseServerClient();
  const cookieStore = await cookies();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const preferredOrgId =
    cookieStore.get("current_org_id")?.value ||
    cookieStore.get("nadiplan_current_org")?.value;

  let query = supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (preferredOrgId) {
    query = query.eq("org_id", preferredOrgId);
  }

  const { data: memberships, error } = await query;
  if (error || !memberships?.length) return null;
  return memberships[0].org_id;
}
