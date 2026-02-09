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
}: IssueTableProps) {
  if (loading) {
    return (
      <div className="cockpit-card-secondary flex items-center justify-center py-6">
        <span className="cockpit-body text-muted-foreground/70">—</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cockpit-card-secondary flex items-center justify-center py-6 border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]">
        <span className="cockpit-body cockpit-status-at-risk">{error}</span>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="cockpit-card-secondary flex items-center justify-center py-6">
        <span className="cockpit-body text-muted-foreground">No decisions</span>
      </div>
    );
  }

  return (
    <div className="cockpit-card-secondary p-0 overflow-hidden">
      <Table className="cockpit-table">
        <TableHeader>
          <TableRow className="border-0 h-0">
            <TableHead className="w-[90px] px-3 py-1.5">Status</TableHead>
            <TableHead className="px-3 py-1.5">Station</TableHead>
            <TableHead className="px-3 py-1.5">Area</TableHead>
            <TableHead className="px-3 py-1.5">Shift</TableHead>
            <TableHead className="px-3 py-1.5 text-right">NO-GO</TableHead>
            <TableHead className="px-3 py-1.5 text-right">Warn</TableHead>
            <TableHead className="px-3 py-1.5 text-right">GO</TableHead>
            <TableHead className="px-3 py-1.5">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((row) => {
            const isAcceptedRisk = row.resolved && row.decision_actions?.includes?.("acknowledged");
            return (
            <TableRow
              key={row.issue_id}
              className={cn(
                "cursor-pointer px-3 py-1.5",
                !row.resolved && row.severity === "BLOCKING" && "border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]",
                !row.resolved && row.severity === "WARNING" && "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]",
                isAcceptedRisk && "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]"
              )}
              onClick={() => onRowClick(row)}
              data-testid={`issue-row-${row.issue_id}`}
            >
              <TableCell className="px-3 py-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                    <SeverityText severity={row.severity} />
                    {row.resolved && (
                      <span className="cockpit-label cockpit-status-ok">Closed</span>
                    )}
                    {isAcceptedRisk && (
                      <span className="cockpit-label cockpit-status-at-risk">Accepted</span>
                    )}
                </div>
              </TableCell>
              <TableCell className="px-3 py-1.5 cockpit-body font-medium">
                {row.station_name ?? row.station_code ?? row.station_id?.slice(0, 8) ?? "—"}
              </TableCell>
              <TableCell className="px-3 py-1.5 cockpit-body text-muted-foreground">{row.area ?? row.line ?? "—"}</TableCell>
              <TableCell className="px-3 py-1.5 cockpit-body">{row.shift_code}</TableCell>
              <TableCell className="px-3 py-1.5 text-right cockpit-num">
                {row.no_go_count != null && row.no_go_count > 0 ? (
                  <span className="cockpit-status-blocking font-medium">{row.no_go_count}</span>
                ) : (
                  <span className="text-muted-foreground">{row.no_go_count ?? 0}</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-right cockpit-num">
                {row.warning_count != null && row.warning_count > 0 ? (
                  <span className="cockpit-status-at-risk font-medium">{row.warning_count}</span>
                ) : (
                  <span className="text-muted-foreground">{row.warning_count ?? 0}</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-right cockpit-num text-muted-foreground">{row.go_count ?? 0}</TableCell>
              <TableCell className="px-3 py-1.5 cockpit-body">{row.recommended_action || "—"}</TableCell>
            </TableRow>
          );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
