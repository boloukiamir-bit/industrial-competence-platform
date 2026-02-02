/**
 * Server-only helpers for admin user invite/reset.
 * SUPABASE_SERVICE_ROLE_KEY must only be used in server context (API routes).
 */

import { createClient } from "@supabase/supabase-js";

const RATE_LIMIT_MS = 30_000;
const inviteRateLimit = new Map<string, number>();

function now(): number {
  return Date.now();
}

function pruneRateLimit(): void {
  const cutoff = now() - RATE_LIMIT_MS;
  for (const [email, ts] of inviteRateLimit.entries()) {
    if (ts < cutoff) inviteRateLimit.delete(email);
  }
}

export function checkInviteRateLimit(email: string): boolean {
  pruneRateLimit();
  const key = email.toLowerCase().trim();
  const last = inviteRateLimit.get(key);
  if (last != null && now() - last < RATE_LIMIT_MS) return true;
  inviteRateLimit.set(key, now());
  return false;
}

export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase configuration (SUPABASE_SERVICE_ROLE_KEY server-side only)");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getRedirectBase(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (base) return base.replace(/\/$/, "");
  return "";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
