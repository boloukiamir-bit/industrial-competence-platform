"use client";

import { Button } from "@/components/ui/button";
import { InlinePanelShell } from "@/components/cockpit/InlinePanelShell";
import { cn } from "@/lib/utils";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";

export type ReadinessStatus = "GO" | "WARNING" | "NO-GO";

export type ReadinessCounts = {
  totalActive: number;
  blockingCount: number;
  warningCount: number;
  illegalCount: number;
  unstaffedCount: number;
};

export type ReadinessTopStationRow = {
  station_name: string;
  station_id: string;
  issue_type: string;
  root_cause_primary: string;
  shift_code: string;
  date: string;
  issue: CockpitIssueRow;
};

export type ReadinessPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  status: ReadinessStatus;
  subtitle: string;
  counts: ReadinessCounts;
  topStations: ReadinessTopStationRow[];
  onRowClick: (issue: CockpitIssueRow) => void;
  sessionOk?: boolean;
  /** When set with date + shiftCode, show "Freeze Readiness" button (execution snapshot). */
  onFreeze?: () => void;
  freezeLoading?: boolean;
  date?: string;
  shiftCode?: string;
};

const ISSUE_TYPE_LABEL: Record<string, string> = {
  ILLEGAL: "ILLEGAL",
  UNSTAFFED: "UNSTAFFED",
  NO_GO: "NO-GO",
  WARNING: "WARNING",
};

function badgeVariant(issueType: string): string {
  if (issueType === "ILLEGAL" || issueType === "UNSTAFFED" || issueType === "NO_GO") {
    return "cockpit-status-blocking";
  }
  return "cockpit-status-at-risk";
}

export function ReadinessPanel({
  open,
  title,
  onClose,
  status,
  subtitle,
  counts,
  topStations,
  onRowClick,
  sessionOk = true,
  onFreeze,
  freezeLoading = false,
  date,
  shiftCode,
}: ReadinessPanelProps) {
  const showFreeze = Boolean(onFreeze && date && shiftCode);
  return (
    <InlinePanelShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      dataTestId="readiness-panel"
    >
      <div className="flex flex-wrap gap-3 mb-4">
        <span
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: "var(--hairline)", color: "var(--text-2)", background: "var(--surface-2)" }}
        >
          Blocking: {counts.blockingCount}
        </span>
        <span
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: "var(--hairline)", color: "var(--text-2)", background: "var(--surface-2)" }}
        >
          Illegal: {counts.illegalCount}
        </span>
        <span
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: "var(--hairline)", color: "var(--text-2)", background: "var(--surface-2)" }}
        >
          Unstaffed: {counts.unstaffedCount}
        </span>
        <span
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: "var(--hairline)", color: "var(--text-2)", background: "var(--surface-2)" }}
        >
          Warnings: {counts.warningCount}
        </span>
      </div>
      {status === "GO" ? (
        <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
          Operational legitimacy is stable.
        </p>
      ) : topStations.length === 0 ? (
        <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
          No blocker stations to list.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>
            Top blockers
          </p>
          <ul className="space-y-0">
            {topStations.map((row) => (
              <li
                key={row.issue.issue_id}
                className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--hairline-soft)] last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => sessionOk && onRowClick(row.issue)}
                  disabled={!sessionOk}
                  className="flex-1 min-w-0 flex flex-wrap items-center gap-3 text-left rounded-md transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
                  data-testid={`readiness-row-${row.issue.issue_id}`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-sm" style={{ color: "var(--text)" }}>
                    {row.station_name || row.station_id || "—"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0 px-1.5 py-0.5 rounded",
                      badgeVariant(row.issue_type)
                    )}
                  >
                    {ISSUE_TYPE_LABEL[row.issue_type] ?? row.issue_type}
                  </span>
                  <span className="min-w-0 max-w-[45%] truncate text-sm" style={{ color: "var(--text-2)" }}>
                    {row.root_cause_primary}
                  </span>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => sessionOk && onRowClick(row.issue)}
                  disabled={!sessionOk}
                >
                  Review
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {showFreeze && (
        <div className="mt-6 pt-4 border-t border-[var(--hairline-soft)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFreeze}
            disabled={!sessionOk || freezeLoading}
            data-testid="readiness-freeze-button"
          >
            {freezeLoading ? "Freezing…" : "Freeze Readiness"}
          </Button>
        </div>
      )}
    </InlinePanelShell>
  );
}
