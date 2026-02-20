"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/services/auth";

/**
 * When mounted on "/", redirects to /app/cockpit if the user is authenticated.
 * Renders nothing (caller wraps landing content).
 */
export function AuthRedirectToCockpit() {
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (cancelled) return;
        if (session?.user && session?.access_token) {
          router.replace("/app/cockpit");
          return;
        }
        setDecided(true);
      })
      .catch(() => setDecided(true));
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
