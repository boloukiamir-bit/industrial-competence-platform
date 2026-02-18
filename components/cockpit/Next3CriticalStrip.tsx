"use client";

import { Button } from "@/components/ui/button";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";
import { cn } from "@/lib/utils";

export type Next3CriticalStripProps = {
  issues: CockpitIssueRow[];
  onViewDecision: (issue: CockpitIssueRow) => void;
};

function sortCriticalFirst(issues: CockpitIssueRow[]): CockpitIssueRow[] {
  const open = issues.filter((i) => !i.resolved);
  return [...open].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "BLOCKING" ? -1 : 1;
    const stationA = (a.station_name ?? a.station_code ?? a.station_id ?? "").toLowerCase();
    const stationB = (b.station_name ?? b.station_code ?? b.station_id ?? "").toLowerCase();
    return stationA.localeCompare(stationB);
  });
}

export function Next3CriticalStrip({ issues, onViewDecision }: Next3CriticalStripProps) {
  const critical = sortCriticalFirst(issues).slice(0, 3);
  if (critical.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-3 mb-5"
      data-testid="next-3-critical-strip"
    >
      <span className="cockpit-brief-label mr-0.5">Next 3 critical</span>
      {critical.map((issue) => {
        const station = issue.station_name ?? issue.station_code ?? issue.station_id?.slice(0, 8) ?? "—";
        const area = issue.area ?? issue.line ?? "—";
        const isBlocking = issue.severity === "BLOCKING";
        return (
          <div
            key={issue.issue_id}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm",
              "bg-white border-border shadow-sm hover:shadow hover:border-border/80 transition-shadow"
            )}
          >
            <span className={isBlocking ? "cockpit-severity-pill-blocking" : "cockpit-severity-pill-warning"}>
              {isBlocking ? "Blocking" : "At risk"}
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {station} · {area}
            </span>
            <Button
              size="sm"
              variant="default"
              className="cockpit-btn-pill cockpit-btn-pill-primary border-0"
              onClick={() => onViewDecision(issue)}
              data-testid={`next3-resolve-${issue.issue_id}`}
            >
              Resolve
            </Button>
          </div>
        );
      })}
    </div>
  );
}
