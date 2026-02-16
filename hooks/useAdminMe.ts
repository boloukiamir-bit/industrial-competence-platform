"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type AdminMe = {
  email: string | null;
  userId?: string;
  active_org_id: string;
  active_site_id?: string | null;
  membership_role: string;
  auth?: "dev_bearer" | "cookie" | "bearer";
};

type UseAdminMeResult = {
  adminMe: AdminMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useAdminMe(): UseAdminMeResult {
  const [adminMe, setAdminMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const headers: HeadersInit = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch("/api/admin/me", { credentials: "include", headers });
      if (!res.ok) {
        setAdminMe(null);
        setError(`admin/me returned ${res.status}`);
        return;
      }
      const data = await res.json();
      setAdminMe({
        email: data.email ?? null,
        userId: data.userId ?? undefined,
        active_org_id: data.active_org_id,
        active_site_id: data.active_site_id ?? null,
        membership_role: data.membership_role ?? "",
        auth: data.auth,
      });
    } catch (err) {
      setAdminMe(null);
      setError(err instanceof Error ? err.message : "Failed to load admin context");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminMe();
  }, [fetchAdminMe]);

  return { adminMe, loading, error, refresh: fetchAdminMe };
}
