"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PAGE_MAX_WIDTH = "1600px";

function useIsDev(): boolean {
  if (typeof window === "undefined") return process.env.NODE_ENV !== "production";
  return window.location.hostname === "localhost" || process.env.NODE_ENV !== "production";
}

export interface PageFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sticky top bar: filters, date picker, etc. */
  filterBar?: React.ReactNode;
  /** Optional debug panel content; only rendered when hostname is localhost or NODE_ENV !== production */
  debugPanel?: React.ReactNode;
  /** Content area (main scrollable) */
  children: React.ReactNode;
}

export function PageFrame({ filterBar, debugPanel, children, className, ...props }: PageFrameProps) {
  const isDev = useIsDev();
  return (
    <div className={cn("w-full mx-auto px-4 sm:px-8 py-6", className)} style={{ maxWidth: PAGE_MAX_WIDTH }} {...props}>
      {filterBar != null && (
        <div
          className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-8 sm:px-8 py-2.5 mb-4 backdrop-blur-sm"
          style={{
            background: "color-mix(in srgb, var(--bg, hsl(var(--background))) 97%, transparent)",
            borderBottom: "1px solid var(--hairline-soft, hsl(var(--border)))",
          }}
        >
          {filterBar}
        </div>
      )}
      {isDev && debugPanel != null && (
        <div
          className="mb-4 rounded border border-dashed p-3 font-mono text-xs"
          style={{ borderColor: "var(--hairline, rgba(15,23,42,0.10))", background: "var(--surface-2, hsl(var(--muted) / 0.3))", color: "var(--text-2, hsl(var(--muted-foreground)))" }}
          data-testid="page-frame-debug-panel"
        >
          {debugPanel}
        </div>
      )}
      <main className="min-h-0">{children}</main>
    </div>
  );
}
