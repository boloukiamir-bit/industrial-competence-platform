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
        "w-full rounded-xl border border-[var(--hairline, rgba(15,23,42,0.08))] bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow] hover:border-[var(--hairline-soft)] hover:shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--text)]/20 focus:ring-offset-2 min-h-[88px] max-h-[110px] flex flex-col justify-between",
        className
      )}
      data-testid={tileId ?? "kpi-tile"}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
          {title}
        </span>
        {statusChip != null && (
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", chipClass)}>
            {statusChip}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-lg font-bold tabular-nums" style={{ color: "var(--text)" }}>
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
