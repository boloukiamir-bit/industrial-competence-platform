"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface UserProfile {
  id: string;
  email: string | null;
  role: "admin" | "hr" | "manager" | "user" | null;
}

export interface UseProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  runBootstrap: () => Promise<{ success: boolean; message: string }>;
  canBootstrap: boolean;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canBootstrap, setCanBootstrap] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Try to get the user's profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        // Check if table exists by looking for any profiles
        const { data: anyProfiles, error: countError } = await supabase
          .from("profiles")
          .select("id")
          .limit(1);

        if (countError?.code === "PGRST116" || countError?.message?.includes("does not exist")) {
          // Table doesn't exist
          setCanBootstrap(true);
          setProfile({
            id: session.user.id,
            email: session.user.email || null,
            role: null,
          });
        } else if (!anyProfiles || anyProfiles.length === 0) {
          // Table exists but empty - user can bootstrap
          setCanBootstrap(true);
          setProfile({
            id: session.user.id,
            email: session.user.email || null,
            role: null,
          });
        } else {
          // Table exists with profiles but user not found
          setProfile({
            id: session.user.id,
            email: session.user.email || null,
            role: null,
          });
        }
      } else {
        setProfile(profileData as UserProfile);
        setCanBootstrap(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  const runBootstrap = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, message: "Not authenticated" };
      }

      const response = await fetch("/api/bootstrap", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Bootstrap failed" };
      }

      // Refresh profile after bootstrap
      await fetchProfile();
      
      return { success: true, message: data.message || "Bootstrap complete" };
    } catch (err) {
      return { 
        success: false, 
        message: err instanceof Error ? err.message : "Bootstrap failed" 
      };
    }
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    runBootstrap,
    canBootstrap,
  };
}

/**
 * Get the redirect path after login. Always cockpit; never HR tasks.
 */
export function getRoleRedirectPath(role: string | null): string {
  return "/app/cockpit";
}
