"use client";

import { DecisionCard } from "@/components/cockpit/DecisionCard";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";

export type DecisionCardsGridProps = {
  issues: CockpitIssueRow[];
  loading: boolean;
  error: string | null;
  markedPlannedIds: Set<string>;
  /** Set of "station_id:shift_code" for stations with legal blockers; cards show ILLEGAL badge. */
  legalStopperStationKeys?: Set<string>;
  /** When set, the card with this station_id is highlighted (e.g. from deep link). */
  highlightStationId?: string | null;
  onViewDecision: (issue: CockpitIssueRow) => void;
  onMarkPlanned: (issueId: string) => void;
};

/** Sort: BLOCKING open → WARNING open → Accepted Risk → Planned last. Within bucket: area, station, shift. */
function sortForGrid(
  issues: CockpitIssueRow[],
  markedPlannedIds: Set<string>
): CockpitIssueRow[] {
  const open = issues.filter((i) => !i.resolved);
  const acceptedRisk = issues.filter(
    (i) => i.resolved && i.decision_actions?.includes?.("acknowledged")
  );
  const bucketOrder = (issue: CockpitIssueRow) => {
    if (markedPlannedIds.has(issue.issue_id)) return 4;
    if (!issue.resolved) return issue.severity === "BLOCKING" ? 1 : 2;
    return 3;
  };
  const bySecondary = (a: CockpitIssueRow, b: CockpitIssueRow) => {
    const areaA = (a.area ?? a.line ?? "").toLowerCase();
    const areaB = (b.area ?? b.line ?? "").toLowerCase();
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    const stationA = (a.station_name ?? a.station_code ?? a.station_id ?? "").toLowerCase();
    const stationB = (b.station_name ?? b.station_code ?? b.station_id ?? "").toLowerCase();
    if (stationA !== stationB) return stationA.localeCompare(stationB);
    return (a.shift_code ?? "").localeCompare(b.shift_code ?? "");
  };
  const combined = [...open, ...acceptedRisk];
  return combined.sort((a, b) => {
    const oA = bucketOrder(a);
    const oB = bucketOrder(b);
    if (oA !== oB) return oA - oB;
    return bySecondary(a, b);
  });
}

export function DecisionCardsGrid({
  issues,
  loading,
  error,
  markedPlannedIds,
  legalStopperStationKeys,
  highlightStationId,
  onViewDecision,
  onMarkPlanned,
}: DecisionCardsGridProps) {
  if (loading) {
    return (
      <div className="cockpit-cc-card flex items-center justify-center py-14">
        <span className="cockpit-cc-body text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cockpit-cc-card flex items-center justify-center py-14 border-l-4 border-l-red-400">
        <span className="cockpit-cc-body text-red-600 dark:text-red-400">{error}</span>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="cockpit-cc-card flex items-center justify-center py-14">
        <span className="cockpit-cc-body text-muted-foreground">No decisions</span>
      </div>
    );
  }

  const sorted = sortForGrid(issues, markedPlannedIds);

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      data-testid="decision-cards-grid"
    >
      {sorted.map((issue) => (
        <DecisionCard
          key={issue.issue_id}
          issue={issue}
          markedPlanned={markedPlannedIds.has(issue.issue_id)}
          isLegalStopper={
            legalStopperStationKeys != null &&
            issue.station_id != null &&
            issue.shift_code != null &&
            legalStopperStationKeys.has(issue.station_id + ":" + issue.shift_code)
          }
          highlight={highlightStationId != null && issue.station_id === highlightStationId}
          onResolve={onViewDecision}
          onPlan={onMarkPlanned}
        />
      ))}
    </div>
  );
}
