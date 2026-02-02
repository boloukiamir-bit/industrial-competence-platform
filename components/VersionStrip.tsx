"use client";

import { useEffect, useState } from "react";

type VersionInfo = {
  gitSha: string;
  vercelEnv: string;
  nodeEnv: string;
  pilotMode: boolean;
  supabaseUrlHost: string;
};

/**
 * Version strip: SHA | ENV | PILOT | DB host.
 * Shown when NODE_ENV !== "production" OR NEXT_PUBLIC_SHOW_VERSION_STRIP === "true".
 * Hidden in production by default.
 */
export function VersionStrip() {
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/version", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setInfo(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 py-1 text-[10px] font-mono text-muted-foreground bg-muted/50 border-t border-border"
      data-testid="version-strip"
    >
      <span>SHA: {info.gitSha.slice(0, 7)}</span>
      <span>|</span>
      <span>ENV: {info.vercelEnv}</span>
      <span>|</span>
      <span>PILOT: {info.pilotMode ? "true" : "false"}</span>
      <span>|</span>
      <span>DB: {info.supabaseUrlHost}</span>
    </div>
  );
}
