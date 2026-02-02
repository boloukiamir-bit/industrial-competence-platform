"use client";

import { useEffect, useState } from "react";

type SessionDebug = {
  email: string | null;
  currentRole: string | null;
  active_org_id: string | null;
  active_site_id: string | null;
  pilotMode: boolean;
  error?: string;
};

/**
 * DEV only. Thin strip showing session debug: email, currentRole, active_org_id, active_site_id, PILOT_MODE.
 * Never render in production (parent should check NODE_ENV).
 */
export function SessionDebugStrip() {
  const [data, setData] = useState<SessionDebug | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/session-debug", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ email: null, currentRole: null, active_org_id: null, active_site_id: null, pilotMode: false, error: "fetch failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-xs font-mono bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800"
      data-testid="session-debug-strip"
    >
      <span title="email">email: {data.email ?? "—"}</span>
      <span title="currentRole">role: {data.currentRole ?? "—"}</span>
      <span title="active_org_id">org: {data.active_org_id ? `${data.active_org_id.slice(0, 8)}…` : "—"}</span>
      <span title="active_site_id">site: {data.active_site_id ? `${data.active_site_id.slice(0, 8)}…` : "—"}</span>
      <span title="PILOT_MODE">PILOT_MODE: {data.pilotMode ? "true" : "false"}</span>
      {data.error && <span className="text-red-600 dark:text-red-400">({data.error})</span>}
    </div>
  );
}
