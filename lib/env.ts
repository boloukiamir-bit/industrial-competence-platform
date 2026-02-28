/**
 * Environment variable helper with fail-fast behavior
 * Ensures Supabase credentials are always available
 */

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Hardcoded fallback values for production builds
const FALLBACK_SUPABASE_URL = "https://bmvawfrnlpdvcmffqrzc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM";

/**
 * Get public environment variables with fail-fast behavior
 * Throws if credentials are not available
 */
export function getPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Supabase env missing: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

/**
 * Check if public environment is properly configured
 * Returns validation result without throwing
 */
export function validatePublicEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Application origin for absolute redirect URLs (e.g. password reset).
 * Prod: NEXT_PUBLIC_SITE_URL or https://VERCEL_URL. Dev: http://127.0.0.1:5001.
 * No trailing slash.
 */
export function getAppOrigin(): string {
  const fromSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (fromSite && !fromSite.includes("placeholder")) return fromSite;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://127.0.0.1:5001";
}

/**
 * Get the service role key (server-side only)
 * Never expose this to client code
 */
export function getServiceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error('Service role key must never be accessed on the client');
  }
  
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  
  return key;
}
