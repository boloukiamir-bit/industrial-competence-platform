"use client";

import { useState, useEffect, useRef } from "react";
import { fetchJsonOrThrow, type FetchJsonThrowError } from "@/lib/coreFetch";
import { normalizeLines, type LineMeta } from "@/lib/normalize";
import { Loader2 } from "lucide-react";

export type LineMetaPanel = LineMeta;

export function StationsLinesPanel({
  onLinesLoaded,
}: {
  onLinesLoaded?: (lines: LineMeta[]) => void;
}) {
  const onLinesLoadedRef = useRef(onLinesLoaded);
  onLinesLoadedRef.current = onLinesLoaded;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [lines, setLines] = useState<LineMeta[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLines([]);

    fetchJsonOrThrow<unknown>("/api/line-overview/lines", {
      credentials: "include",
      cache: "no-store",
    })
      .then((payload) => {
        if (cancelled) return;
        const normalized = normalizeLines(payload ?? {});
        setLines(normalized);
        onLinesLoadedRef.current?.(normalized);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as Partial<FetchJsonThrowError>;
        const status = typeof e?.status === "number" ? e.status : undefined;
        const message =
          status === 401
            ? "Session expired. Reload/login."
            : (e?.message && String(e.message)) || "Failed to fetch lines";
        setError({ status, message });
        setLines([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
        data-testid="lines-error"
      >
        {error.status != null && (
          <span className="font-medium">HTTP {error.status}</span>
        )}
        {error.status != null && " — "}
        {error.message}
        {error.status === 401 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="underline hover:no-underline"
            >
              Reload
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm" data-testid="lines-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading lines…
      </div>
    );
  }

  return (
    <ul className="text-sm text-muted-foreground space-y-1" data-testid="lines-list">
      {lines.length === 0 ? (
        <li>No lines</li>
      ) : (
        lines.map((l) => (
          <li key={l.lineCode}>
            {l.lineName} ({l.lineCode})
            {typeof l.stationCount === "number" ? ` — ${l.stationCount} stations` : ""}
          </li>
        ))
      )}
    </ul>
  );
}
