"use client";

import { statusToPillVariant } from "@/components/ui/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";

export type { CockpitIssueRow };

export type IssueTableProps = {
  issues: CockpitIssueRow[];
  loading: boolean;
  error: string | null;
  onRowClick: (row: CockpitIssueRow) => void | Promise<void>;
  /** Issue IDs marked as planned (client-only); show "Planned" pill on row. */
  markedPlannedIds?: Set<string>;
  /** When false, rows are non-interactive (disabled cursor + tooltip). */
  sessionOk?: boolean;
};

function SeverityText({ severity }: { severity: string }) {
  const variant = statusToPillVariant(severity);
  const label = severity === "WARNING" ? "At risk" : severity === "BLOCKING" ? "Blocking" : severity;
  const colorClass = variant === "BLOCKING" ? "cockpit-status-blocking" : variant === "AT_RISK" ? "cockpit-status-at-risk" : "cockpit-status-ok";
  return <span className={cn("text-xs font-medium", colorClass)}>{label}</span>;
}

export function IssueTable({
  issues,
  loading,
  error,
  onRowClick,
  markedPlannedIds,
  sessionOk = true,
}: IssueTableProps) {
  if (loading) {
    return (
      <div className="gov-panel flex items-center justify-center py-8">
        <span className="cockpit-body" style={{ color: "var(--text-3)" }}>—</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gov-panel flex items-center justify-center py-8 border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]">
        <span className="cockpit-body cockpit-status-at-risk">{error}</span>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="gov-panel flex items-center justify-center py-8">
        <span className="cockpit-body" style={{ color: "var(--text-2)" }}>No decisions</span>
      </div>
    );
  }

  return (
    <div className="gov-panel p-0 overflow-hidden">
      <Table className="cockpit-table">
        <TableHeader>
          <TableRow className="border-0 h-0">
            <TableHead className="w-[90px] px-3 py-2.5">Status</TableHead>
            <TableHead className="px-3 py-2.5">Station</TableHead>
            <TableHead className="px-3 py-2.5">Area</TableHead>
            <TableHead className="px-3 py-2.5">Shift</TableHead>
            <TableHead className="px-3 py-2.5 text-right">NO-GO</TableHead>
            <TableHead className="px-3 py-2.5 text-right">Warn</TableHead>
            <TableHead className="px-3 py-2.5 text-right">GO</TableHead>
            <TableHead className="px-3 py-2.5">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((row) => {
            const isAcceptedRisk = row.resolved && row.decision_actions?.includes?.("acknowledged");
            return (
            <TableRow
              key={row.issue_id}
              className={cn(
                "transition-colors",
                sessionOk ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                !row.resolved && row.severity === "BLOCKING" && "border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]",
                !row.resolved && row.severity === "WARNING" && "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]",
                isAcceptedRisk && "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]"
              )}
              onClick={() => {
                if (process.env.NODE_ENV !== "production") {
                  console.log("[ui] issue-row-click", {
                    station_id: row.station_id,
                    station_code: row.station_code,
                    shift_code: row.shift_code,
                    date: row.date,
                  });
                }
                if (sessionOk) onRowClick(row);
              }}
              title={sessionOk ? undefined : "Sign in to review"}
              data-testid={`issue-row-${row.issue_id}`}
            >
              <TableCell className="px-3 py-2.5">
                <div className="flex items-center gap-1 flex-wrap">
                    <SeverityText severity={row.severity} />
                    {row.resolved && (
                      <span className="cockpit-label cockpit-status-ok">Closed</span>
                    )}
                    {isAcceptedRisk && (
                      <span className="cockpit-label cockpit-status-at-risk">Accepted</span>
                    )}
                    {markedPlannedIds?.has(row.issue_id) && (
                      <span className="cockpit-label text-muted-foreground border border-[var(--hairline-soft)]">Planned</span>
                    )}
                </div>
              </TableCell>
              <TableCell className="px-3 py-2.5 cockpit-body font-medium" style={{ color: "var(--text)" }}>
                {row.station_name ?? row.station_code ?? row.station_id?.slice(0, 8) ?? "—"}
              </TableCell>
              <TableCell className="px-3 py-2.5 cockpit-body" style={{ color: "var(--text-2)" }}>{row.area ?? row.line ?? "—"}</TableCell>
              <TableCell className="px-3 py-2.5 cockpit-body">{row.shift_code}</TableCell>
              <TableCell className="px-3 py-2.5 text-right cockpit-num">
                {row.no_go_count != null && row.no_go_count > 0 ? (
                  <span className="cockpit-status-blocking font-medium">{row.no_go_count}</span>
                ) : (
                  <span style={{ color: "var(--text-3)" }}>{row.no_go_count ?? 0}</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right cockpit-num">
                {row.warning_count != null && row.warning_count > 0 ? (
                  <span className="cockpit-status-at-risk font-medium">{row.warning_count}</span>
                ) : (
                  <span style={{ color: "var(--text-3)" }}>{row.warning_count ?? 0}</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right cockpit-num" style={{ color: "var(--text-3)" }}>{row.go_count ?? 0}</TableCell>
              <TableCell className="px-3 py-2.5 cockpit-body" style={{ color: "var(--text-2)" }}>{row.recommended_action || "—"}</TableCell>
            </TableRow>
          );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
