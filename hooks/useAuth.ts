"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthUser, getSession, onAuthStateChange } from "@/services/auth";
import type { User } from "@supabase/supabase-js";

type AuthState = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
};

export function useAuth(requireAuth = true): AuthState {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const session = await getSession();
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
          } else if (requireAuth) {
            router.push("/login");
          }
        }
      } catch {
        if (mounted && requireAuth) {
          router.push("/login");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (mounted) {
        const typedSession = session as { user?: User } | null;
        if (event === "SIGNED_OUT") {
          setUser(null);
          if (requireAuth) {
            router.push("/login");
          }
        } else if (event === "SIGNED_IN" && typedSession?.user) {
          setUser(typedSession.user);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [requireAuth, router]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
}
