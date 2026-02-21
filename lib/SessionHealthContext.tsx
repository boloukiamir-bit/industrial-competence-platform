"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SessionHealth = {
  has_session: boolean;
  user: { id: string; email: string | null } | null;
  error: string | null;
  cookie_present: boolean;
  now: string;
};

type SessionHealthState = {
  /** true = valid session, false = no/expired session, null = not yet known */
  hasSession: boolean | null;
  loading: boolean;
  /** Last raw payload (dev or for banner message) */
  payload: SessionHealth | null;
  refetch: () => void;
};

const SessionHealthContext = createContext<SessionHealthState | null>(null);

const SESSION_HEALTH_URL = "/api/debug/session-health";

export function SessionHealthProvider({ children }: { children: ReactNode }) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<SessionHealth | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(SESSION_HEALTH_URL, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const has = !!data.has_session;
      setHasSession(has);
      setPayload(
        data.ok
          ? {
              has_session: !!data.has_session,
              user: data.user ?? null,
              error: data.error ?? null,
              cookie_present: !!data.cookie_present,
              now: data.now ?? new Date().toISOString(),
            }
          : null
      );
      if (process.env.NODE_ENV !== "production" && data.ok) {
        console.log("[session-health response]", data);
      }
    } catch (err) {
      console.error("[session-health]", err);
      setHasSession(false);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const value: SessionHealthState = {
    hasSession,
    loading,
    payload,
    refetch: fetchHealth,
  };

  return (
    <SessionHealthContext.Provider value={value}>
      {children}
    </SessionHealthContext.Provider>
  );
}

export function useSessionHealth(): SessionHealthState {
  const ctx = useContext(SessionHealthContext);
  if (!ctx) {
    return {
      hasSession: null,
      loading: true,
      payload: null,
      refetch: () => {},
    };
  }
  return ctx;
}
