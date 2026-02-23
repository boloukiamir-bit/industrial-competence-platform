"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { CheckCircle2, GraduationCap, Loader2, ArrowLeftRight, AlertTriangle, AlertCircle, ClipboardList, ExternalLink } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/coreFetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DrilldownRosterItem } from "@/app/api/cockpit/issues/drilldown/route";
import { EmployeeDrawer } from "@/components/employees/EmployeeDrawer";

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
  decision_type?: string | null;
  decision_created_at?: string | null;
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
  onPlanAction?: () => void | Promise<void>;
  onPlanTraining?: () => void | Promise<void>;
  onSwap: () => Promise<void>;
  onEscalate: () => Promise<void>;
  onResolve?: () => Promise<void>;
  isAcknowledged: boolean;
  /** After recording a decision, call to refresh cockpit issues list. */
  onDecisionRecorded?: () => void | Promise<void>;
  /** True when issue is marked as planned (action or training) — shows PLANNED badge, keeps issue visible. */
  planned?: boolean;
  /** When false, roster rows are not clickable (no employee drawer). */
  sessionOk?: boolean;
  /** When "global", Record decision / Swap / Escalate / Resolve are disabled; Plan action/training only if roster loaded. */
  cockpitMode?: "global" | "shift";
};

const statusVariant = (status: string) => {
  switch (status) {
    case "NO_GO":
      return "destructive";
    case "WARNING":
      return "secondary";
    case "GO":
      return "outline";
    default:
      return "secondary";
  }
};

function rosterLabel(r: DrilldownRosterItem): string {
  const first = r.first_name?.trim();
  const last = r.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return r.employee_anst_id;
}

export function IssueDrawer({
  open,
  onOpenChange,
  issue,
  onAcknowledge,
  onPlanAction,
  onPlanTraining,
  onSwap,
  onEscalate,
  onResolve,
  isAcknowledged,
  onDecisionRecorded,
  planned = false,
  sessionOk = true,
  cockpitMode = "shift",
}: IssueDrawerProps) {
  const isGlobal = cockpitMode === "global";
  const canRecordDecision = !isGlobal;
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<"ack" | "plan_action" | "plan_training" | "swap" | "escalate" | "resolve" | null>(null);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionType, setDecisionType] = useState<"ACKNOWLEDGED" | "OVERRIDDEN" | "DEFERRED" | "RESOLVED">("ACKNOWLEDGED");
  const [decisionNote, setDecisionNote] = useState("");
  const [lastCreatedJobId, setLastCreatedJobId] = useState<string | null>(null);
  const [lastCreatedJobTitle, setLastCreatedJobTitle] = useState<string | null>(null);
  const [decisionRecorded, setDecisionRecorded] = useState<{ type: string; at: string } | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownState>(null);
  const hasConcreteEmployee = Boolean(
    drilldown && ((drilldown.blockers?.length ?? 0) + (drilldown.warnings?.length ?? 0) + (drilldown.roster?.length ?? 0) > 0)
  );
  const canPlanInGlobal = isGlobal ? hasConcreteEmployee : true;
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [drilldownErrorStatus, setDrilldownErrorStatus] = useState<number | null>(null);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [resolvingEmployee, setResolvingEmployee] = useState(false);
  const [rosterResolveError, setRosterResolveError] = useState<string | null>(null);

  const fetchDrilldown = useCallback(async () => {
    if (!issue?.station_id || !issue?.date || !issue?.shift_code) {
      setDrilldown(null);
      setDrilldownError(null);
      return;
    }
    setDrilldownLoading(true);
    setDrilldownError(null);
    setDrilldownErrorStatus(null);
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
      const status = "status" in res ? res.status : 0;
      setDrilldownError("Could not load station details.");
      setDrilldownErrorStatus(status);
      setDrilldown(null);
      setDrilldownLoading(false);
      if (process.env.NODE_ENV !== "production") {
        console.log("[ui] issue-drawer-fetch-error", {
          stationId: issue.station_id,
          status,
          bodySnippet: res.error ?? "(no message)",
        });
      }
      return;
    }
    const data = res.data;
    if (!data?.station && !Array.isArray(data?.roster)) {
      setDrilldownError("Could not load station details.");
      setDrilldownErrorStatus(200);
      setDrilldown(null);
      setDrilldownLoading(false);
      if (process.env.NODE_ENV !== "production") {
        console.log("[ui] issue-drawer-fetch-error", {
          stationId: issue.station_id,
          status: 200,
          bodySnippet: data?.error ?? "(no message)",
        });
      }
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
      if (process.env.NODE_ENV !== "production") {
        console.log("[ui] issue-drawer-open", {
          stationId: issue.station_id,
          shift_code: issue.shift_code,
          date: issue.date,
        });
      }
      fetchDrilldown();
    } else {
      setDrilldown(null);
      setDrilldownError(null);
      setDrilldownLoading(false);
      if (!open) {
        setShowDecisionForm(false);
        setLastCreatedJobId(null);
        setLastCreatedJobTitle(null);
      }
    }
  }, [open, issue?.station_id, issue?.date, issue?.shift_code, fetchDrilldown]);

  const rosterHeadcount = drilldown?.kpis?.headcount ?? 0;
  const noGoCount = drilldown?.kpis?.no_go ?? 0;
  const warningCount = drilldown?.kpis?.warning ?? 0;

  const handleRosterEmployeeClick = async (r: DrilldownRosterItem & Record<string, unknown>) => {
    if (!sessionOk) return;
    setRosterResolveError(null);
    const eid = r.employee_id ?? r.employeeId ?? null;
    const empNo = r.employee_number ?? r.employeeNumber ?? r.employee_anst_id ?? null;
    if (process.env.NODE_ENV !== "production") {
      console.log("[ui] roster-employee-click", { employee_id: eid ?? undefined, employee_number: empNo ?? undefined });
    }
    if (eid != null && typeof eid === "string") {
      setSelectedEmployeeId(eid);
      setEmployeeDrawerOpen(true);
      return;
    }
    if (empNo != null && String(empNo).trim() !== "") {
      setResolvingEmployee(true);
      const res = await fetchJson<{ ok?: boolean; employee_id?: string }>(
        `/api/employees/resolve?employee_number=${encodeURIComponent(String(empNo).trim())}`
      );
      setResolvingEmployee(false);
      if (res.ok && res.data?.employee_id) {
        setSelectedEmployeeId(res.data.employee_id);
        setEmployeeDrawerOpen(true);
      } else {
        setRosterResolveError("Could not resolve employee");
      }
      return;
    }
    setRosterResolveError("Missing employee identifier");
  };

  const handleAcknowledge = async () => {
    setSubmitting("ack");
    try {
      await onAcknowledge();
      onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  const getTemplateCodeForIssue = (): string => {
    const t = (issue?.issue_type ?? issue?.type ?? "").toUpperCase();
    if (t === "UNSTAFFED") return "STAFFING_ACTION";
    if (t === "ILLEGAL") return "COMPLIANCE_ACTION";
    return "TRAINING_ACTION";
  };

  const getFirstRosterEmployeeAnstId = (): string | null => {
    if (!drilldown) return null;
    const first = drilldown.blockers?.[0] ?? drilldown.warnings?.[0] ?? drilldown.roster?.[0];
    return first?.employee_anst_id ?? null;
  };

  const handlePlanAction = async () => {
    setSubmitting("plan_action");
    try {
      const anstId = getFirstRosterEmployeeAnstId();
      if (!anstId?.trim()) {
        toast({ title: "Load roster first or add a station assignee", variant: "destructive" });
        return;
      }
      const resolveRes = await fetchJson<{ ok?: boolean; employee_id?: string }>(
        `/api/employees/resolve?employee_number=${encodeURIComponent(anstId.trim())}`
      );
      if (!resolveRes.ok || !resolveRes.data?.employee_id) {
        toast({ title: "Could not resolve assignee (employee number or site context)", variant: "destructive" });
        return;
      }
      const rc = issue?.root_cause as Record<string, unknown> | null | undefined;
      const rootCausePrimary = rc && typeof rc.primary === "string" ? rc.primary : "";
      const jobRes = await fetchJson<{ id?: string }>("/api/hr/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_code: getTemplateCodeForIssue(),
          employee_id: resolveRes.data.employee_id,
          metadata: {
            station_name: issue?.station_name ?? issue?.station_code ?? issue?.station_id ?? "",
            station_id: issue?.station_id ?? "",
            date: issue?.date ?? "",
            shift_code: issue?.shift_code ?? "",
            line: issue?.line ?? "",
            issue_type: (issue?.issue_type ?? issue?.type ?? "").toUpperCase(),
            root_cause_primary: rootCausePrimary,
          },
        }),
      });
      if (!jobRes.ok || !jobRes.data?.id) {
        toast({ title: !jobRes.ok ? jobRes.error : "Failed to create intervention", variant: "destructive" });
        return;
      }
      onPlanAction?.();
      setLastCreatedJobId(jobRes.data.id);
      setLastCreatedJobTitle("Intervention");
      toast({ title: "Intervention created. Record a decision to link it, or open the job below." });
      // Optional: router.push(`/app/hr/jobs/${jobRes.data.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create intervention", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  const handlePlanTraining = async () => {
    setSubmitting("plan_training");
    try {
      const anstId = getFirstRosterEmployeeAnstId();
      if (!anstId?.trim()) {
        toast({ title: "Load roster first or add a station assignee", variant: "destructive" });
        return;
      }
      const resolveRes = await fetchJson<{ ok?: boolean; employee_id?: string }>(
        `/api/employees/resolve?employee_number=${encodeURIComponent(anstId.trim())}`
      );
      if (!resolveRes.ok || !resolveRes.data?.employee_id) {
        toast({ title: "Could not resolve assignee (employee number or site context)", variant: "destructive" });
        return;
      }
      const rc = issue?.root_cause as Record<string, unknown> | null | undefined;
      const rootCausePrimary = rc && typeof rc.primary === "string" ? rc.primary : "";
      const jobRes = await fetchJson<{ id?: string }>("/api/hr/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_code: "TRAINING_ACTION",
          employee_id: resolveRes.data.employee_id,
          metadata: {
            station_name: issue?.station_name ?? issue?.station_code ?? issue?.station_id ?? "",
            station_id: issue?.station_id ?? "",
            date: issue?.date ?? "",
            shift_code: issue?.shift_code ?? "",
            line: issue?.line ?? "",
            issue_type: (issue?.issue_type ?? issue?.type ?? "").toUpperCase(),
            root_cause_primary: rootCausePrimary,
          },
        }),
      });
      if (!jobRes.ok || !jobRes.data?.id) {
        toast({ title: !jobRes.ok ? jobRes.error : "Failed to create intervention", variant: "destructive" });
        return;
      }
      onPlanTraining?.();
      setLastCreatedJobId(jobRes.data.id);
      setLastCreatedJobTitle("Intervention");
      toast({ title: "Intervention created. Record a decision to link it, or open the job below." });
      // Optional: router.push(`/app/hr/jobs/${jobRes.data.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create intervention", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  const handleSubmitDecision = async () => {
    if (!issue?.station_id || !issue?.date || !issue?.shift_code) return;
    setSubmitting("ack");
    try {
      const issueType = (issue?.issue_type ?? issue?.type ?? "NO_GO").toString().toUpperCase();
      const res = await fetchJson<{ ok?: boolean; error?: string }>("/api/cockpit/issues/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          station_id: issue.station_id,
          date: issue.date,
          shift_code: issue.shift_code,
          issue_type: issueType,
          decision_type: decisionType,
          resolved: decisionType === "RESOLVED",
          note: decisionNote.trim() || undefined,
          ...(lastCreatedJobId && { linked_job_id: lastCreatedJobId }),
        }),
      });
      if (!res.ok) {
        toast({ title: !res.ok && "error" in res ? res.error : "Failed to record decision", variant: "destructive" });
        return;
      }
      setDecisionRecorded({ type: decisionType, at: new Date().toISOString() });
      setShowDecisionForm(false);
      setDecisionNote("");
      setLastCreatedJobId(null);
      setLastCreatedJobTitle(null);
      toast({ title: "Decision recorded" });
      await onDecisionRecorded?.();
      if (decisionType === "RESOLVED") onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  const handleResolve = async () => {
    if (!onResolve) return;
    setSubmitting("resolve");
    try {
      await onResolve();
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
  const recordDecisionTooltip = canRecordDecision ? undefined : "Switch to SHIFT to record a decision.";
  const planTooltip = canPlanInGlobal ? undefined : (isGlobal ? "Load roster first or switch to SHIFT to plan an action for this shift." : undefined);

  const statusBadge = (issue.issue_type ?? issue.type ?? issue.severity) as string;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0 gap-0 h-full max-h-[100dvh]" aria-describedby={undefined}>
        <div className="flex-none shrink-0 border-b bg-background pl-6 pr-14 py-4">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-base font-semibold leading-tight">
              {stationName} · {issue.shift_code}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {issue.area ?? issue.line ?? "—"}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant={issue.severity === "BLOCKING" ? "destructive" : "secondary"}>
                {statusBadge === "NO_GO" ? "NO-GO" : statusBadge === "UNSTAFFED" ? "UNSTAFFED" : statusBadge === "ILLEGAL" ? "ILLEGAL" : statusBadge}
              </Badge>
              {issue.resolved && (
                <Badge variant="outline" className="text-green-600 border-green-300">Closed</Badge>
              )}
              {issue.resolved && issue.decision_actions?.includes?.("acknowledged") && (
                <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50 font-medium" title="Risk accepted and logged for audit">
                  Accepted Risk
                </Badge>
              )}
              {planned && (
                <Badge variant="secondary" className="text-muted-foreground font-normal">PLANNED</Badge>
              )}
              {(decisionRecorded || (issue.decision_created_at && issue.decision_type)) && (
                <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50 font-medium" title="Decision recorded for audit">
                  DECISION RECORDED · {decisionRecorded?.type ?? issue.decision_type ?? "—"} · {decisionRecorded?.at ? new Date(decisionRecorded.at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : issue.decision_created_at ? new Date(issue.decision_created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : ""}
                </Badge>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {primary && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm leading-snug">{primary}</p>
            </section>
          )}

          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Evidence</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Blocking</p>
                <p className="text-lg font-bold tabular-nums mt-0.5 text-destructive">{noGoCount}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Warnings</p>
                <p className="text-lg font-bold tabular-nums mt-0.5 text-amber-600">{warningCount}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Roster</p>
                <p className="text-lg font-bold tabular-nums mt-0.5">{rosterHeadcount}</p>
              </div>
            </div>
          </section>

          {issue.recommended_action && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recommended action</p>
              <p className="text-sm">{issue.recommended_action}</p>
            </section>
          )}

          {drilldownError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-2" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">{drilldownError}</p>
                {drilldownErrorStatus != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">Status: {drilldownErrorStatus}</p>
                )}
              </div>
            </div>
          )}

          {!drilldownError && (drilldown?.blockers?.length ?? 0) + (drilldown?.warnings?.length ?? 0) > 0 && (
            <section>
              {rosterResolveError && (
                <p className="text-sm text-destructive mb-2" role="alert">{rosterResolveError}</p>
              )}
              {resolvingEmployee && <p className="text-xs text-muted-foreground mb-2">Resolving employee…</p>}
              {drilldownLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {drilldown && drilldown.blockers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Blockers (NO-GO)</p>
                      <ul className="space-y-1">
                        {drilldown.blockers.map((r) => (
                          <li
                            key={r.employee_anst_id}
                            className={cn(
                              "flex items-center justify-between rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-sm",
                              sessionOk && "cursor-pointer hover:bg-destructive/10"
                            )}
                            onClick={() => handleRosterEmployeeClick(r)}
                            title={sessionOk ? undefined : "Sign in to interact"}
                          >
                            <span className="font-medium truncate">{rosterLabel(r)}</span>
                            <span className="text-muted-foreground tabular-nums text-xs">{r.actual_level ?? "—"} / {r.required_level}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {drilldown && drilldown.warnings.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Warnings</p>
                      <ul className="space-y-1">
                        {drilldown.warnings.map((r) => (
                          <li
                            key={r.employee_anst_id}
                            className={cn(
                              "flex items-center justify-between rounded border px-2.5 py-1.5 text-sm",
                              sessionOk && "cursor-pointer hover:bg-muted/50"
                            )}
                            onClick={() => handleRosterEmployeeClick(r)}
                            title={sessionOk ? undefined : "Sign in to interact"}
                          >
                            <span className="font-medium truncate">{rosterLabel(r)}</span>
                            <span className="text-muted-foreground tabular-nums text-xs">{r.actual_level ?? "—"} / {r.required_level}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {showDecisionForm && (
            <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record decision</p>
              <div className="space-y-2">
                <Label htmlFor="decision-type">Decision type</Label>
                <Select value={decisionType} onValueChange={(v) => setDecisionType(v as "ACKNOWLEDGED" | "OVERRIDDEN" | "DEFERRED" | "RESOLVED")}>
                  <SelectTrigger id="decision-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                    <SelectItem value="OVERRIDDEN">Overridden</SelectItem>
                    <SelectItem value="DEFERRED">Deferred</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="decision-note">Note (optional)</Label>
                <Textarea id="decision-note" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Add context for audit…" rows={2} className="resize-none" />
              </div>
              {lastCreatedJobId && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>Linked intervention: {lastCreatedJobTitle ?? "Intervention"}.</span>
                  <Button type="button" variant="ghost" size="sm" className="p-0 h-auto text-primary underline hover:no-underline" onClick={() => router.push(`/app/hr/jobs/${lastCreatedJobId}`)}>
                    View job <ExternalLink className="h-3 w-3 inline ml-0.5" />
                  </Button>
                </p>
              )}
            </section>
          )}

          {isAcknowledged && (
            <div className="rounded-sm bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Decision recorded
              </p>
            </div>
          )}
        </div>

        <div className="flex-none shrink-0 sticky bottom-0 border-t bg-background px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} data-testid="btn-close">
              Close
            </Button>
            {showActions && (
              <>
                <Button
                  onClick={handlePlanAction}
                  disabled={!!submitting || !canPlanInGlobal}
                  variant="outline"
                  data-testid="btn-plan-action"
                  title={planTooltip}
                >
                  {submitting === "plan_action" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
                  Plan action
                </Button>
                <Button
                  onClick={handlePlanTraining}
                  disabled={!!submitting || !canPlanInGlobal}
                  variant="outline"
                  data-testid="btn-plan-training"
                  title={planTooltip}
                >
                  {submitting === "plan_training" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
                  Plan training
                </Button>
              </>
            )}
            {showActions && (
              showDecisionForm ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => setShowDecisionForm(false)} disabled={!!submitting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitDecision}
                    disabled={!!submitting || !canRecordDecision}
                    variant="default"
                    data-testid="btn-decision-submit"
                    title={recordDecisionTooltip}
                  >
                    {submitting === "ack" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Submit decision
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowDecisionForm(true)}
                  disabled={!!submitting || !canRecordDecision}
                  variant="default"
                  data-testid="btn-acknowledge"
                  title={recordDecisionTooltip}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Record decision
                </Button>
              )
            )}
            {onResolve && showActions && !issue.resolved && (
              <Button
                onClick={handleResolve}
                disabled={!!submitting || !canRecordDecision}
                variant="destructive"
                data-testid="btn-resolve"
                title={recordDecisionTooltip}
              >
                {submitting === "resolve" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Resolve
              </Button>
            )}
            <Button
              onClick={handleSwap}
              disabled={!!submitting || !canRecordDecision}
              variant="outline"
              data-testid="btn-swap"
              title={recordDecisionTooltip}
            >
              {submitting === "swap" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
              Swap
            </Button>
            <Button
              onClick={handleEscalate}
              disabled={!!submitting || !canRecordDecision}
              variant="outline"
              data-testid="btn-escalate"
              title={recordDecisionTooltip}
            >
              {submitting === "escalate" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Escalate
            </Button>
          </div>
        </div>
      </SheetContent>
      <EmployeeDrawer
        open={employeeDrawerOpen}
        onOpenChange={setEmployeeDrawerOpen}
        employeeId={selectedEmployeeId}
      />
    </Sheet>
  );
}
