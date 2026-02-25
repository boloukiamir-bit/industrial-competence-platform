"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type OrgIdentity = {
  org: { id: string; name: string; logo_url?: string };
  site: { id: string; name: string } | null;
};

type OrgIdentityContextValue = {
  identity: OrgIdentity | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const OrgIdentityContext = createContext<OrgIdentityContextValue | null>(null);

export function useOrgIdentity(): OrgIdentityContextValue {
  const ctx = useContext(OrgIdentityContext);
  if (!ctx) {
    return {
      identity: null,
      loading: false,
      error: "OrgIdentityProvider missing",
      refresh: () => {},
    };
  }
  return ctx;
}

export function OrgIdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<OrgIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdentity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/org/identity", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        org?: { id: string; name: string; logo_url?: string };
        site?: { id: string; name: string } | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to load identity");
        setIdentity(null);
        return;
      }
      if (data.ok && data.org) {
        setIdentity({
          org: {
            id: data.org.id,
            name: data.org.name ?? "",
            logo_url: data.org.logo_url ?? undefined,
          },
          site: data.site ?? null,
        });
      } else {
        setIdentity(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load identity");
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const refresh = useCallback(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  return (
    <OrgIdentityContext.Provider
      value={{ identity, loading, error, refresh }}
    >
      {children}
    </OrgIdentityContext.Provider>
  );
}
