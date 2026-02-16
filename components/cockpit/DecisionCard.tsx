"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";
import { COST_ENGINE, formatSekRange, formatHoursRange, FRAGILITY_PTS } from "@/lib/cockpitCostEngine";

export type DecisionCardProps = {
  issue: CockpitIssueRow;
  markedPlanned?: boolean;
  /** When true, show ILLEGAL badge (station has compliance blockers). */
  isLegalStopper?: boolean;
  /** When true, card is highlighted (e.g. deep link focus). */
  highlight?: boolean;
  onResolve: (issue: CockpitIssueRow) => void;
  onPlan: (issueId: string) => void;
};

function getRecommendedAction(issue: CockpitIssueRow): string {
  if (issue.resolved && issue.decision_actions?.includes?.("acknowledged")) {
    return "Contain recurrence (next shift)";
  }
  return issue.recommended_action || (issue.severity === "BLOCKING" ? "Reassign operator (now)" : "Stabilize coverage");
}

function getRootCauseShort(issue: CockpitIssueRow): string {
  const rc = issue.root_cause as Record<string, unknown> | null | undefined;
  if (rc && typeof rc.primary === "string") return rc.primary;
  return issue.recommended_action || "Coverage gap";
}

function isAcceptedRisk(issue: CockpitIssueRow): boolean {
  return Boolean(issue.resolved && issue.decision_actions?.includes?.("acknowledged"));
}

export function DecisionCard({ issue, markedPlanned, isLegalStopper, highlight, onResolve, onPlan }: DecisionCardProps) {
  const acceptedRisk = isAcceptedRisk(issue);
  const stationLabel = issue.station_name ?? issue.station_code ?? issue.station_id?.slice(0, 8) ?? "—";
  const areaLabel = issue.area ?? issue.line ?? "—";
  const action = getRecommendedAction(issue);
  const why = getRootCauseShort(issue);
  const r = COST_ENGINE[issue.severity];
  const fragilityPts = FRAGILITY_PTS[issue.severity];
  const impactStr = acceptedRisk
    ? `${formatSekRange(r.costMin, r.costMax)} deferred · Next 1–2 shifts`
    : `−${fragilityPts} fragility · ${formatSekRange(r.costMin, r.costMax)} · ${formatHoursRange(r.hoursMin, r.hoursMax)}`;

  const severityLabel = acceptedRisk ? "Accepted" : issue.severity;
  const severityPillClass =
    acceptedRisk
      ? "cockpit-severity-pill-accepted"
      : issue.severity === "BLOCKING"
        ? "cockpit-severity-pill-blocking"
        : "cockpit-severity-pill-warning";

  return (
    <article
      className={cn(
        "cockpit-cc-card p-6 cursor-pointer",
        !issue.resolved && issue.severity === "BLOCKING" && "cockpit-cc-card--blocking",
        !issue.resolved && issue.severity === "WARNING" && "cockpit-cc-card--warning",
        issue.resolved && "cockpit-cc-card--resolved",
        markedPlanned && "ring-2 ring-offset-2 ring-offset-[hsl(40_20%_98%)] ring-amber-400/50",
        isLegalStopper && "border-l-[3px] border-l-destructive bg-destructive/5 dark:bg-destructive/10",
        highlight && "ring-2 ring-offset-2 ring-primary"
      )}
      onClick={() => onResolve(issue)}
      data-testid={`decision-card-${issue.issue_id}`}
      {...(issue.station_id ? { "data-decision-station-id": issue.station_id } : {})}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(severityPillClass, isLegalStopper && "opacity-70")}>
              {severityLabel}
            </span>
            {isLegalStopper && (
              <span
                className="inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wide rounded-md border border-destructive/60 bg-destructive text-destructive-foreground dark:bg-destructive/70 dark:text-white dark:border-destructive/50"
                aria-label="Illegal to schedule"
              >
                ILLEGAL
              </span>
            )}
          </div>
          {issue.resolved && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">
              Closed
            </span>
          )}
        </div>

        <div className="space-y-0.5 min-h-14">
          <p className="cockpit-cc-card-hero">
            {stationLabel} <span className="text-muted-foreground">/</span> {areaLabel}{" "}
            <span className="text-muted-foreground">/</span> {issue.shift_code ?? "—"}
          </p>
          <p className="cockpit-cc-card-hero-meta">Station · Area · Shift</p>
          {isLegalStopper && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-destructive/80 dark:text-destructive/90 mt-1">
              Cannot legally operate
            </p>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="cockpit-cc-recommended">{action}</p>
          <p className="cockpit-cc-card-meta-label">Recommended action</p>
        </div>

        <div className="space-y-0.5">
          <p className="cockpit-cc-card-meta-value">{impactStr}</p>
          <p className="cockpit-cc-card-meta-label">Impact</p>
        </div>

        {why && why !== action && (
          <div className="space-y-0.5 pt-5 border-t border-[hsl(220_14%_97%)]">
            <p className="cockpit-cc-card-meta-value">{why}</p>
            <p className="cockpit-cc-card-meta-label">Root cause</p>
          </div>
        )}

        {!issue.resolved && (
          <div className="cockpit-cc-cta-row" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="default"
              className="cockpit-cc-cta-primary border-0 text-white"
              onClick={() => onResolve(issue)}
              data-testid={`decision-card-resolve-${issue.issue_id}`}
            >
              Resolve now
            </Button>
            <button
              type="button"
              className="cockpit-cc-cta-link"
              onClick={() => onPlan(issue.issue_id)}
              data-testid={`decision-card-plan-${issue.issue_id}`}
              title="Defers resolution; issue stays open."
            >
              {markedPlanned ? <Check className="h-3 w-3 mr-1 inline-block" /> : null}
              {markedPlanned ? "Planned (deferred)" : "Plan (defer)"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
