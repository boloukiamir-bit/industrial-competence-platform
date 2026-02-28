import { supabase } from "@/lib/supabaseClient";

/** Base URL of the app (e.g. https://pilot.bcledge.com or http://localhost:3000). Used for magic link redirect. */
function getAppOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/**
 * Send a magic link to the given email (passwordless). Redirect URL is APP_ORIGIN/api/auth/callback.
 * Does not reveal whether an account exists; caller should show a deterministic success message.
 */
export async function signInWithOtp(email: string): Promise<{ error?: { message: string } }> {
  const emailRedirectTo = `${getAppOrigin()}/api/auth/callback`;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo },
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
