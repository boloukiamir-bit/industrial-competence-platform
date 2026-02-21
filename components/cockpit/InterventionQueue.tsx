"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";
import { COST_ENGINE, formatSekRange, formatHoursRange, FRAGILITY_PTS } from "@/lib/cockpitCostEngine";
import { cn } from "@/lib/utils";

export type InterventionQueueProps = {
  issues: CockpitIssueRow[];
  markedPlannedIds: Set<string>;
  onMarkPlanned: (issueId: string) => void;
  onViewDecision: (issue: CockpitIssueRow) => void;
  /** When set, matches header fragility so "Fragility now" stays in sync after closing decisions. */
  currentFragility?: number;
  /** When false, Open/Plan are disabled and show tooltip. */
  sessionOk?: boolean;
};

function getRecommendedAction(issue: CockpitIssueRow): string {
  if (issue.resolved && issue.decision_actions?.includes?.("acknowledged")) {
    return "Contain recurrence (next shift)";
  }
  return issue.severity === "BLOCKING" ? "Reassign operator (now)" : "Stabilize coverage";
}

function isAcceptedRisk(issue: CockpitIssueRow): boolean {
  return Boolean(issue.resolved && issue.decision_actions?.includes?.("acknowledged"));
}

/** Sort: BLOCKING open → WARNING open → Accepted Risk → Planned last. Within bucket: area, station, shift. */
function sortQueueItems(
  issues: CockpitIssueRow[],
  markedPlannedIds: Set<string>
): CockpitIssueRow[] {
  const open = issues.filter((i) => !i.resolved);
  const acceptedRisk = issues.filter(isAcceptedRisk);
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

export function InterventionQueue({
  issues,
  markedPlannedIds,
  onMarkPlanned,
  onViewDecision,
  currentFragility: currentFragilityProp,
  sessionOk = true,
}: InterventionQueueProps) {
  const openIssues = issues.filter((i) => !i.resolved);
  const acceptedRiskIssues = issues.filter(isAcceptedRisk);
  const queueItems = sortQueueItems([...openIssues, ...acceptedRiskIssues], markedPlannedIds);


  if (queueItems.length === 0) return null;

  return (
    <div className="gov-panel p-0 overflow-hidden mb-6" data-testid="intervention-queue">
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))" }}>
        <p className="gov-kicker">Intervention Queue</p>
      </div>
      <ul style={{ borderColor: "var(--hairline-soft, rgba(15,23,42,0.06))" }} className="divide-y">
        {queueItems.map((issue) => {
          const acceptedRisk = isAcceptedRisk(issue);
          const action = getRecommendedAction(issue);
          const r = COST_ENGINE[issue.severity];
          const fragilityPts = FRAGILITY_PTS[issue.severity];
          const marked = markedPlannedIds.has(issue.issue_id);
          const stationLabel = issue.station_name ?? issue.station_code ?? issue.station_id?.slice(0, 8) ?? "—";

          const inlineMeta = acceptedRisk
            ? `${formatSekRange(r.costMin, r.costMax)} deferred · Next 1–2 shifts`
            : `Fragility −${fragilityPts} · ${formatSekRange(r.costMin, r.costMax)} · Next 1–2 shifts`;

          const leftRule = !acceptedRisk && issue.severity === "BLOCKING"
            ? "border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]"
            : !acceptedRisk && issue.severity === "WARNING"
              ? "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]"
              : acceptedRisk
                ? "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]"
                : "";
          return (
            <li
              key={issue.issue_id}
              className={cn(
                "px-5 py-3",
                marked && "bg-[var(--surface-2)]",
                leftRule,
                !sessionOk && "opacity-60"
              )}
              title={sessionOk ? undefined : "Sign in to review"}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="cockpit-body font-medium" style={{ color: "var(--text)" }}>{stationLabel}</span>
                    {issue.area && <span className="cockpit-label">{issue.area}</span>}
                    {acceptedRisk && (
                      <span className="cockpit-label cockpit-status-at-risk">Accepted</span>
                    )}
                  </div>
                  <p className="cockpit-body mt-0.5" style={{ color: "var(--text-2)" }}>
                    {action} — <span className="cockpit-num">{inlineMeta}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn("h-7 text-[13px]", !sessionOk && "cursor-not-allowed")}
                    onClick={() => sessionOk && onViewDecision(issue)}
                    disabled={!sessionOk}
                    title={sessionOk ? undefined : "Sign in to review"}
                    data-testid={`intervention-view-${issue.issue_id}`}
                  >
                    Review
                  </Button>
                  <Button
                    size="sm"
                    variant={marked ? "secondary" : "ghost"}
                    className={cn("h-7 text-[13px]", !sessionOk && "cursor-not-allowed")}
                    onClick={() => sessionOk && onMarkPlanned(issue.issue_id)}
                    disabled={!sessionOk}
                    title={sessionOk ? undefined : "Sign in to review"}
                    data-testid={`intervention-mark-planned-${issue.issue_id}`}
                  >
                    {marked ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                    {marked ? "Planned" : "Plan action"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
