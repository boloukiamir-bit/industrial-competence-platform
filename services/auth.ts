import { supabase } from "@/lib/supabaseClient";
import { getAppOrigin } from "@/lib/env";

/**
 * Sign in with email and password. Returns session data on success.
 * Caller should sync session via POST /api/auth/callback with access_token and refresh_token.
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error?: { message: string }; session?: { access_token: string; refresh_token: string } }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: { message: error.message } };
  const session = data.session;
  if (!session?.access_token || !session?.refresh_token)
    return { error: { message: "No session returned" } };
  return { session: { access_token: session.access_token, refresh_token: session.refresh_token } };
}

/**
 * Send password reset email. Redirect URL is APP_ORIGIN/api/auth/callback?next=/reset-password.
 * Does not reveal whether an account exists; caller should show a deterministic success message.
 */
export async function resetPasswordForEmail(
  email: string
): Promise<{ error?: { message: string } }> {
  const redirectTo = `${getAppOrigin()}/api/auth/callback?next=/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) return { error: { message: error.message } };
  return {};
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
