"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, GraduationCap, Loader2, ArrowLeftRight, AlertTriangle, AlertCircle } from "lucide-react";
import { fetchJson } from "@/lib/coreFetch";
import type { DrilldownRosterItem } from "@/app/api/cockpit/issues/drilldown/route";
import { COST_ENGINE, formatSekRange } from "@/lib/cockpitCostEngine";

export type CockpitIssueRow = {
  issue_id: string;
  type: string;
  severity: "BLOCKING" | "WARNING";
  issue_type?: "NO_GO" | "WARNING" | "GO" | "UNSTAFFED" | "ILLEGAL";
  line: string;
  shift_code: string;
  date: string;
  root_cause: unknown;
  recommended_action: string;
  station_id?: string;
  station_code?: string | null;
  station_name?: string | null;
  area?: string | null;
  resolved?: boolean;
  decision_actions?: string[];
};

export type DrilldownRow = {
  org_id: string;
  site_id: string | null;
  shift_code: string;
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  area: string | null;
  employee_anst_id: string;
  actual_level: number | null;
  status: "NO_GO" | "WARNING" | "GO";
};

type DrilldownState = {
  station: { id: string; code: string | null; name: string | null; area: string | null; shift_code: string; date: string } | null;
  roster: DrilldownRosterItem[];
  kpis: { no_go: number; warning: number; go: number; headcount: number };
  blockers: DrilldownRosterItem[];
  warnings: DrilldownRosterItem[];
} | null;

export type IssueDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: CockpitIssueRow | null;
  onAcknowledge: () => Promise<void>;
  onPlanTraining: () => Promise<void>;
  onSwap: () => Promise<void>;
  onEscalate: () => Promise<void>;
  isAcknowledged: boolean;
};

const statusVariant = (status: string) => {
  switch (status) {
    case "NO_GO":
    case "ILLEGAL":
      return "destructive";
    case "WARNING":
      return "secondary";
    case "UNSTAFFED":
      return "outline";
    case "GO":
      return "outline";
    default:
      return "secondary";
  }
};

function issueTypeToBadgeVariant(issueType: string | undefined): "destructive" | "secondary" | "outline" {
  const t = (issueType ?? "").toUpperCase().replace(/-/g, "_");
  if (t === "ILLEGAL" || t === "NO_GO") return "destructive";
  if (t === "UNSTAFFED") return "outline";
  if (t === "WARNING") return "secondary";
  return "secondary";
}

function issueTypeToLabel(issueType: string | undefined): string {
  const t = (issueType ?? "").toUpperCase().replace(/-/g, "_");
  if (t === "ILLEGAL") return "ILLEGAL";
  if (t === "UNSTAFFED") return "UNSTAFFED";
  if (t === "NO_GO") return "Blocking";
  if (t === "WARNING") return "At risk";
  if (t === "GO") return "OK";
  return "At risk";
}

function rosterLabel(r: DrilldownRosterItem): string {
  const first = r.first_name?.trim();
  const last = r.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return r.employee_anst_id;
}

function DecisionImpactBlock({ issue }: { issue: CockpitIssueRow }) {
  const severity = issue.severity;
  const range = COST_ENGINE[severity];
  const isAcceptedRisk = issue.resolved && issue.decision_actions?.includes?.("acknowledged");
  const isMitigated = issue.resolved && !isAcceptedRisk;

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Effect</p>
      {issue.resolved ? (
        <>
          {isMitigated && (
            <div className="rounded border border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20 p-2.5 space-y-1.5">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground">Cost avoided</p>
                  <p className="font-medium tabular-nums text-green-700 dark:text-green-300">{formatSekRange(range.costMin, range.costMax)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Time saved</p>
                  <p className="font-medium tabular-nums text-green-700 dark:text-green-300">{range.hoursMin}–{range.hoursMax} op·h</p>
                </div>
              </div>
            </div>
          )}
          {isAcceptedRisk && (
            <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 p-2.5 space-y-1.5">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground">Cost deferred</p>
                  <p className="font-medium tabular-nums text-amber-700 dark:text-amber-300">{formatSekRange(range.costMin, range.costMax)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Time deferred</p>
                  <p className="font-medium tabular-nums text-amber-700 dark:text-amber-300">{range.hoursMin}–{range.hoursMax} op·h</p>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">
            After: {isAcceptedRisk ? "May recur next 1–2 shifts" : "Next 7 days"}
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Cost</p>
              <p className="font-medium tabular-nums">{formatSekRange(range.costMin, range.costMax)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Time</p>
              <p className="font-medium tabular-nums">{range.hoursMin}–{range.hoursMax} op·h</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Fragility Δ</p>
              <p className="font-medium tabular-nums text-green-600 dark:text-green-400">
                {severity === "BLOCKING" ? "−25" : "−8"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">
            After: Next 1–2 shifts
          </p>
        </>
      )}
    </div>
  );
}

export function IssueDrawer({
  open,
  onOpenChange,
  issue,
  onAcknowledge,
  onPlanTraining,
  onSwap,
  onEscalate,
  isAcknowledged,
}: IssueDrawerProps) {
  const [submitting, setSubmitting] = useState<"ack" | "plan" | "swap" | "escalate" | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownState>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);

  const fetchDrilldown = useCallback(async () => {
    if (!issue?.station_id || !issue?.date || !issue?.shift_code) {
      setDrilldown(null);
      setDrilldownError(null);
      return;
    }
    setDrilldownLoading(true);
    setDrilldownError(null);
    const params = new URLSearchParams({
      date: issue.date,
      shift_code: issue.shift_code,
      station_id: issue.station_id,
    });
    const res = await fetchJson<{
      ok?: boolean;
      station?: DrilldownState extends null ? never : NonNullable<DrilldownState>["station"];
      roster?: DrilldownRosterItem[];
      kpis?: { no_go: number; warning: number; go: number; headcount: number };
      blockers?: DrilldownRosterItem[];
      warnings?: DrilldownRosterItem[];
      error?: string;
    }>(`/api/cockpit/issues/drilldown?${params.toString()}`);
    if (!res.ok) {
      setDrilldownError(res.error ?? "Failed to load drilldown");
      setDrilldown(null);
      setDrilldownLoading(false);
      return;
    }
    const data = res.data;
    if (!data?.station && !Array.isArray(data?.roster)) {
      setDrilldownError(data?.error ?? "Failed to load drilldown");
      setDrilldown(null);
      setDrilldownLoading(false);
      return;
    }
    setDrilldown({
      station: data.station ?? null,
      roster: data.roster ?? [],
      kpis: data.kpis ?? { no_go: 0, warning: 0, go: 0, headcount: 0 },
      blockers: data.blockers ?? [],
      warnings: data.warnings ?? [],
    });
    setDrilldownError(null);
    setDrilldownLoading(false);
  }, [issue?.station_id, issue?.date, issue?.shift_code]);

  useEffect(() => {
    if (open && issue?.station_id && issue?.date && issue?.shift_code) {
      fetchDrilldown();
    } else {
      setDrilldown(null);
      setDrilldownError(null);
      setDrilldownLoading(false);
    }
  }, [open, issue?.station_id, issue?.date, issue?.shift_code, fetchDrilldown]);

  const rosterHeadcount = drilldown?.kpis?.headcount ?? 0;
  const noGoCount = drilldown?.kpis?.no_go ?? 0;
  const warningCount = drilldown?.kpis?.warning ?? 0;

  const handleAcknowledge = async () => {
    setSubmitting("ack");
    try {
      await onAcknowledge();
      onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  const handlePlanTraining = async () => {
    setSubmitting("plan");
    try {
      await onPlanTraining();
      onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  const handleSwap = async () => {
    setSubmitting("swap");
    try {
      await onSwap();
      onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  const handleEscalate = async () => {
    setSubmitting("escalate");
    try {
      await onEscalate();
      onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  if (!issue) return null;

  const rc = issue.root_cause as Record<string, unknown> | null | undefined;
  const primary = rc && typeof rc.primary === "string" ? rc.primary : "";
  const stationName = issue.station_name ?? issue.station_code ?? issue.station_id?.slice(0, 8) ?? "—";
  const showActions = !isAcknowledged && issue.station_id && issue.shift_code;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Station coverage decision</SheetTitle>
          <SheetDescription>
            {issue.area ?? issue.line ?? "—"} • {stationName} • {issue.shift_code}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={issueTypeToBadgeVariant(issue.issue_type)}
              className={issue.issue_type === "UNSTAFFED" ? "border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40" : undefined}
            >
              {issueTypeToLabel(issue.issue_type)}
            </Badge>
            <Badge variant="outline">{issue.type}</Badge>
            {issue.resolved && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Closed
              </Badge>
            )}
            {issue.resolved && issue.decision_actions?.includes?.("acknowledged") && (
              <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50 dark:text-amber-300 dark:border-amber-600 dark:bg-amber-950/40 font-medium" title="Risk accepted and logged for audit">
                Accepted Risk (Logged)
              </Badge>
            )}
          </div>

          <DecisionImpactBlock issue={issue} />
          {issue.resolved && issue.decision_actions?.includes?.("acknowledged") && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3" role="status">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Recurrence awareness</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Accepted risks at this station are likely to reoccur in upcoming shifts unless roster or competence changes. Consider planning for next shift.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shadow capacity (read-only)</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Fully qualified (GO)</p>
                <p className="font-medium tabular-nums">{drilldown?.kpis?.go ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total roster</p>
                <p className="font-medium tabular-nums">{rosterHeadcount}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Roster</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">{rosterHeadcount}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">NO-GO</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-destructive">{noGoCount}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Warning</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-amber-600">{warningCount}</p>
            </div>
          </div>

          {drilldownError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Could not load roster</p>
                <p className="text-xs text-muted-foreground mt-0.5">{drilldownError}</p>
              </div>
            </div>
          )}

          {!drilldownError && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Blockers (NO-GO)</p>
              {drilldownLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : drilldown && drilldown.blockers.length > 0 ? (
                <ul className="space-y-2 mb-4">
                  {drilldown.blockers.map((r) => (
                    <li key={r.employee_anst_id} className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                      <span className="font-medium">{rosterLabel(r)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {r.actual_level ?? "—"} / {r.required_level}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : drilldown && !drilldownLoading ? (
                <p className="text-sm text-muted-foreground py-2">None</p>
              ) : null}

              <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4">Warnings</p>
              {!drilldownLoading && drilldown && drilldown.warnings.length > 0 ? (
                <ul className="space-y-2">
                  {drilldown.warnings.map((r) => (
                    <li key={r.employee_anst_id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <span className="font-medium">{rosterLabel(r)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {r.actual_level ?? "—"} / {r.required_level}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : !drilldownLoading && drilldown ? (
                <p className="text-sm text-muted-foreground py-2">None</p>
              ) : null}

              {!drilldownLoading && drilldown && drilldown.roster.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4">All roster</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead>Actual / Required</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldown.roster.map((r) => (
                        <TableRow key={r.employee_anst_id}>
                          <TableCell className="font-medium text-sm">{rosterLabel(r)}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {r.actual_level ?? "—"} / {r.required_level}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(r.status)} className="text-[10px]">
                              {r.status.replace("_", "-")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {!drilldownLoading && drilldown && drilldown.roster.length === 0 && !drilldownError && (
                <p className="text-sm text-muted-foreground py-4">No roster data for this station/shift.</p>
              )}
            </div>
          )}

          {primary && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Root cause
              </p>
              <p className="text-sm">{primary}</p>
            </div>
          )}

          {issue.recommended_action && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Recommended action
              </p>
              <p className="text-sm">{issue.recommended_action}</p>
            </div>
          )}

          {showActions && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button
                onClick={handleAcknowledge}
                disabled={!!submitting}
                variant="outline"
                className="w-full"
                data-testid="btn-acknowledge"
              >
                {submitting === "ack" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Record decision
              </Button>
              <Button
                onClick={handlePlanTraining}
                disabled={!!submitting}
                variant="outline"
                className="w-full"
                data-testid="btn-plan-training"
              >
                {submitting === "plan" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <GraduationCap className="h-4 w-4 mr-2" />
                )}
                Plan training
              </Button>
              <Button
                onClick={handleSwap}
                disabled={!!submitting}
                variant="outline"
                className="w-full"
                data-testid="btn-swap"
              >
                {submitting === "swap" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                )}
                Swap
              </Button>
              <Button
                onClick={handleEscalate}
                disabled={!!submitting}
                variant="outline"
                className="w-full"
                data-testid="btn-escalate"
              >
                {submitting === "escalate" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Escalate
              </Button>
            </div>
          )}

          {isAcknowledged && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Decision recorded
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
