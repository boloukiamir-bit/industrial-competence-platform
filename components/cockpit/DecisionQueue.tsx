"use client";

import { ChevronRight, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";
import { statusToPillVariant } from "@/components/ui/status-pill";

export type DecisionQueueMode = "GLOBAL" | "SHIFT";

// ---- KPI card (compact, always under KPI row) ----

export type DecisionQueueKpiCardProps = {
  issues: CockpitIssueRow[];
  onOpen: () => void;
};

export function DecisionQueueKpiCard({ issues, onOpen }: DecisionQueueKpiCardProps) {
  const active = issues.length;
  const blocking = issues.filter((i) => i.severity === "BLOCKING").length;
  const warning = issues.filter((i) => i.severity === "WARNING").length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-8 w-full rounded-xl border border-[var(--hairline, rgba(15,23,42,0.08))] bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow] hover:border-[var(--hairline-soft)] hover:shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--text)]/20 focus:ring-offset-2"
      data-testid="decision-queue-kpi-card"
    >
      <h2 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
        Decision Queue
      </h2>
      <div className="mt-3 flex flex-wrap items-baseline gap-6">
        <div>
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            Active
          </p>
          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: "var(--text)" }}>
            {active}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            Blocking
          </p>
          <p className="text-lg font-bold tabular-nums mt-0.5 cockpit-status-blocking">
            {blocking}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            Warning
          </p>
          <p className="text-lg font-bold tabular-nums mt-0.5 cockpit-status-at-risk">
            {warning}
          </p>
        </div>
      </div>
    </button>
  );
}

// ---- Inline expand panel (under KPI row, no Sheet) ----

export type DecisionQueueInlinePanelProps = {
  open: boolean;
  issues: CockpitIssueRow[];
  /** Issue IDs marked as planned (client-only); show "Planned" pill on row. */
  markedPlannedIds?: Set<string>;
  mode: DecisionQueueMode;
  onModeChange: (mode: DecisionQueueMode) => void;
  shiftCode?: string;
  availableShiftCodes?: string[];
  onShiftCodeChange?: (code: string) => void;
  onRowClick: (issue: CockpitIssueRow) => void;
  onClose: () => void;
  sessionOk?: boolean;
};

function getRootCausePrimary(issue: CockpitIssueRow): string {
  const rc = issue.root_cause as Record<string, unknown> | null | undefined;
  const primary = rc?.primary;
  return typeof primary === "string" ? primary : "—";
}

function groupActiveIssues(issues: CockpitIssueRow[]): {
  blocking: CockpitIssueRow[];
  warning: CockpitIssueRow[];
} {
  const active = issues.filter((i) => !i.resolved);
  const blocking = active.filter((i) => i.severity === "BLOCKING");
  const warning = active.filter((i) => i.severity === "WARNING");
  return { blocking, warning };
}

export function DecisionQueueInlinePanel({
  open,
  issues,
  markedPlannedIds,
  mode,
  onModeChange,
  shiftCode = "",
  availableShiftCodes = [],
  onShiftCodeChange,
  onRowClick,
  onClose,
  sessionOk = true,
}: DecisionQueueInlinePanelProps) {
  const filtered =
    mode === "SHIFT" && shiftCode
      ? issues.filter((i) => (i.shift_code ?? "").trim().toLowerCase() === shiftCode.trim().toLowerCase())
      : issues;
  const { blocking, warning } = groupActiveIssues(filtered);
  const hasItems = blocking.length > 0 || warning.length > 0;

  return (
    <div
      className={cn(
        "w-full overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
        open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
      )}
      data-testid="decision-queue-inline-panel"
      aria-hidden={!open}
    >
      <div className="mt-4 rounded-xl border border-[var(--hairline, rgba(15,23,42,0.08))] bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Decision Queue
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors sm:ml-0"
              aria-label="Close"
              data-testid="decision-queue-inline-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "SHIFT" && availableShiftCodes.length > 0 && onShiftCodeChange && (
              <Select value={shiftCode || undefined} onValueChange={onShiftCodeChange}>
                <SelectTrigger className="h-8 w-[120px] text-[13px]" data-testid="decision-queue-shift-select">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  {availableShiftCodes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex rounded-md border border-[var(--hairline)] overflow-hidden">
              <button
                type="button"
                onClick={() => onModeChange("GLOBAL")}
                className={cn(
                  "h-8 px-3 text-[13px] font-medium transition-colors",
                  mode === "GLOBAL"
                    ? "bg-[var(--text)] text-white"
                    : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                )}
                data-testid="decision-queue-mode-global"
              >
                GLOBAL
              </button>
              <button
                type="button"
                onClick={() => onModeChange("SHIFT")}
                className={cn(
                  "h-8 px-3 text-[13px] font-medium border-l border-[var(--hairline)] transition-colors",
                  mode === "SHIFT"
                    ? "bg-[var(--text)] text-white"
                    : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                )}
                data-testid="decision-queue-mode-shift"
              >
                SHIFT
              </button>
            </div>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {!hasItems ? (
            <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
              No active decisions.
            </p>
          ) : (
            <div className="space-y-6">
              {blocking.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "hsl(var(--ds-status-blocking-text))" }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                      BLOCKING
                    </span>
                  </div>
                  <ul className="space-y-0">
                    {blocking.map((issue) => (
                      <DecisionQueueRow
                        key={issue.issue_id}
                        issue={issue}
                        markedPlannedIds={markedPlannedIds}
                        onRowClick={onRowClick}
                        sessionOk={sessionOk}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {warning.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "hsl(var(--ds-status-at-risk-text))" }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                      WARNING
                    </span>
                  </div>
                  <ul className="space-y-0">
                    {warning.map((issue) => (
                      <DecisionQueueRow
                        key={issue.issue_id}
                        issue={issue}
                        markedPlannedIds={markedPlannedIds}
                        onRowClick={onRowClick}
                        sessionOk={sessionOk}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionQueueRow({
  issue,
  markedPlannedIds,
  onRowClick,
  sessionOk,
}: {
  issue: CockpitIssueRow;
  markedPlannedIds?: Set<string>;
  onRowClick: (issue: CockpitIssueRow) => void;
  sessionOk: boolean;
}) {
  const variant = statusToPillVariant(issue.severity);
  const badgeClass =
    variant === "BLOCKING"
      ? "cockpit-status-blocking"
      : variant === "AT_RISK"
        ? "cockpit-status-at-risk"
        : "cockpit-status-ok";
  const stationName = issue.station_name ?? issue.station_code ?? issue.station_id ?? "—";
  const primary = getRootCausePrimary(issue);
  const isPlanned = markedPlannedIds?.has(issue.issue_id);

  return (
    <li>
      <button
        type="button"
        onClick={() => sessionOk && onRowClick(issue)}
        disabled={!sessionOk}
        className={cn(
          "w-full flex items-center gap-4 py-3 px-0 text-left rounded-md transition-colors border-b border-[var(--hairline-soft)] last:border-b-0",
          sessionOk && "hover:bg-[var(--surface-2)] cursor-pointer"
        )}
        data-testid={`decision-queue-row-${issue.issue_id}`}
      >
        <span className={cn("text-xs font-medium w-[72px] flex-shrink-0", badgeClass)}>
          {issue.severity === "BLOCKING" ? "BLOCKING" : "WARNING"}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium" style={{ color: "var(--text)" }}>
          {stationName}
        </span>
        <span className="min-w-0 max-w-[40%] truncate text-sm" style={{ color: "var(--text-2)" }}>
          {primary}
        </span>
        {isPlanned && (
          <span className="text-[10px] font-medium text-muted-foreground border border-[var(--hairline-soft)] px-1.5 py-0.5 rounded flex-shrink-0">
            Planned
          </span>
        )}
        <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--text-2)" }}>
          {issue.date}
        </span>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-3)]" aria-hidden />
      </button>
    </li>
  );
}
