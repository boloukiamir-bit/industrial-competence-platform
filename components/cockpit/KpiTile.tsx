"use client";

import { cn } from "@/lib/utils";

export type KpiTileProps = {
  title: string;
  primaryValue: React.ReactNode;
  secondaryLabel?: string;
  secondaryValue?: React.ReactNode;
  /** Optional status chip text e.g. "GO" / "WARNING" / "NO-GO" */
  statusChip?: string;
  statusChipVariant?: "default" | "blocking" | "warning" | "ok";
  onClick: () => void;
  /** Tile id for testid */
  tileId?: string;
  /** Optional icon (e.g. Lucide icon) for the block */
  icon?: React.ReactNode;
  className?: string;
};

export function KpiTile({
  title,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  statusChip,
  statusChipVariant = "default",
  onClick,
  tileId,
  icon,
  className,
}: KpiTileProps) {
  const chipClass =
    statusChipVariant === "blocking"
      ? "cockpit-status-blocking"
      : statusChipVariant === "warning"
        ? "cockpit-status-at-risk"
        : statusChipVariant === "ok"
          ? "cockpit-status-ok"
          : "text-[var(--text-2)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-[var(--hairline, rgba(15,23,42,0.08))] bg-white p-6 text-left shadow-sm transition-[border-color,box-shadow] hover:border-[var(--hairline-soft)] hover:shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--text)]/15 focus:ring-offset-2 min-h-[96px] flex flex-col justify-between",
        className
      )}
      data-testid={tileId ?? "kpi-tile"}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {icon != null && (
            <span className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--hairline)] text-[var(--text-2)] [&>svg]:w-4 [&>svg]:h-4">
              {icon}
            </span>
          )}
          {statusChip != null && (
            <span className={cn("text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded", chipClass)}>
              {statusChip}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap mt-1">
        <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--text)" }}>
          {primaryValue}
        </span>
        {secondaryLabel != null && (
          <span className="text-xs" style={{ color: "var(--text-2)" }}>
            {secondaryLabel}
            {secondaryValue != null && <> {secondaryValue}</>}
          </span>
        )}
      </div>
    </button>
  );
}
