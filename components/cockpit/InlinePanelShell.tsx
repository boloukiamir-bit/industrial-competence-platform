"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlinePanelShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional test id for the wrapper */
  dataTestId?: string;
  className?: string;
};

export function InlinePanelShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  dataTestId = "inline-panel-shell",
  className,
}: InlinePanelShellProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
        open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
      )}
      data-testid={dataTestId}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "mt-4 rounded-xl border border-[var(--hairline, rgba(15,23,42,0.08))] bg-white p-5 shadow-sm",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              {title}
            </h2>
            {subtitle != null && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-2)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors shrink-0"
            aria-label="Close"
            data-testid="inline-panel-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
