"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";
import { formatSekRange, formatHoursRange } from "@/lib/cockpitCostEngine";

export type ReadinessState = "READY" | "AT RISK" | "BLOCKED";

export type OperationalReadinessBannerProps = {
  activeBlocking: number;
  activeWarning: number;
  openCount: number;
  /** First open blocking issue, or first open issue */
  topBlockingIssue: CockpitIssueRow | null;
  onOpenDecision: (issue: CockpitIssueRow) => void;
  onViewInterventions: () => void;
  openRanges: { costMin: number; costMax: number; hoursMin: number; hoursMax: number };
  openFragilityExposure: number;
  avoidedRanges: { costMin: number; costMax: number; hoursMin: number; hoursMax: number };
  deferredRanges: { costMin: number; costMax: number; hoursMin: number; hoursMax: number };
  hasOpen: boolean;
  hasClosed: boolean;
  showResolved: boolean;
};

function getReadinessState(activeBlocking: number, activeWarning: number): ReadinessState {
  if (activeBlocking > 0) return "BLOCKED";
  if (activeWarning > 0) return "AT RISK";
  return "READY";
}

export function OperationalReadinessBanner(props: OperationalReadinessBannerProps) {
  const {
    activeBlocking,
    activeWarning,
    openCount,
    topBlockingIssue,
    onOpenDecision,
    onViewInterventions,
    openRanges,
    openFragilityExposure,
    avoidedRanges,
    deferredRanges,
    hasOpen,
    hasClosed,
    showResolved,
  } = props;

  const state = getReadinessState(activeBlocking, activeWarning);
  const stateLabel = state === "READY" ? "CLEAR" : state;
  const stateClass =
    state === "BLOCKED"
      ? "cockpit-status-blocking"
      : state === "AT RISK"
        ? "cockpit-status-at-risk"
        : "cockpit-status-ok";

  const rc = topBlockingIssue?.root_cause as Record<string, unknown> | null | undefined;
  const reasonShort =
    rc && typeof rc.primary === "string"
      ? rc.primary
      : topBlockingIssue?.recommended_action ?? "Coverage gap";
  const stationLabel =
    topBlockingIssue?.station_name ??
    topBlockingIssue?.station_code ??
    topBlockingIssue?.station_id?.slice(0, 8) ??
    "—";
  const lineLabel = topBlockingIssue?.area ?? topBlockingIssue?.line ?? "—";

  return (
    <div className="w-full py-6 border-b border-border space-y-6" data-testid="operational-readiness-banner">
      {/* 1) SHIFT READINESS */}
      <div
        className={cn(
          "border-l-[3px] pl-4",
          state === "BLOCKED" && "border-l-[hsl(var(--ds-status-blocking-text))]",
          state === "AT RISK" && "border-l-[hsl(var(--ds-status-at-risk-text))]",
          state === "READY" && "border-l-[hsl(var(--ds-status-ok-text))]"
        )}
      >
        <h1 className={cn("text-2xl sm:text-3xl font-semibold tracking-tight", stateClass)} data-testid="shift-readiness-title">
          Shift readiness
        </h1>
        <p className="text-lg font-medium mt-0.5" data-testid="shift-readiness-state">{stateLabel}</p>
        <p className="text-sm text-muted-foreground cockpit-num mt-1" data-testid="shift-readiness-subtext">
          Open decisions: {openCount} · Blocking: {activeBlocking} · At risk: {activeWarning}
        </p>
        {state === "BLOCKED" && (
          <p className="text-sm font-medium mt-2 cockpit-status-blocking" data-testid="shift-readiness-blocked-answer">
            Run next shift without risk? → NO
          </p>
        )}
      </div>

      {/* 2) THE 1-LINE ANSWER */}
      <div className="cockpit-card-primary px-4 py-3">
        <p className="cockpit-label text-muted-foreground mb-1">What must I fix now?</p>
        {topBlockingIssue ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="cockpit-body font-medium">
              Fix now: {stationLabel} ({lineLabel}) — {reasonShort}
            </p>
            <Button variant="default" size="sm" className="h-8 text-[13px] shrink-0" onClick={() => onOpenDecision(topBlockingIssue)} data-testid="decision-center-open-top">
              Open decision
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="cockpit-body text-muted-foreground">No open decisions.</p>
            <Button variant="outline" size="sm" className="h-8 text-[13px] shrink-0" onClick={onViewInterventions} data-testid="readiness-view-interventions">
              View interventions
            </Button>
          </div>
        )}
      </div>

      {/* 3) MANAGEMENT BRIEF */}
      {(hasOpen || (showResolved && hasClosed)) && (
        <div className="cockpit-card-primary p-5" data-testid="management-brief">
          <p className="cockpit-title font-semibold mb-4">Management Brief</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {hasOpen && (
              <>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold">{formatSekRange(openRanges.costMin, openRanges.costMax)}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Exposure if nothing changes (cost)</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold">{formatHoursRange(openRanges.hoursMin, openRanges.hoursMax)}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Exposure if nothing changes (time)</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold">{openFragilityExposure}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Exposure if nothing changes (fragility)</p>
                </div>
              </>
            )}
            {showResolved && hasClosed && (
              <>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-ok">{formatSekRange(avoidedRanges.costMin, avoidedRanges.costMax)}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Avoided if resolved (cost)</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-ok">{formatHoursRange(avoidedRanges.hoursMin, avoidedRanges.hoursMax)}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Avoided if resolved (time)</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-at-risk">{formatSekRange(deferredRanges.costMin, deferredRanges.costMax)}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Deferred if accepted risk (cost)</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-at-risk">{formatHoursRange(deferredRanges.hoursMin, deferredRanges.hoursMax)}</p>
                  <p className="cockpit-label mt-0.5 text-muted-foreground">Deferred if accepted risk (time)</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
