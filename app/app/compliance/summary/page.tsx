"use client";

import { useState, useEffect, useCallback } from "react";
import { OrgGuard } from "@/components/OrgGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Loader2, Inbox, AlertTriangle, Clock, FileX2, CalendarCheck, Sparkles, Mail } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { ComplianceDrawer } from "@/components/compliance/ComplianceDrawer";
import { cn } from "@/lib/utils";

type SummaryResponse = {
  ok: boolean;
  context?: {
    activeSiteId?: string | null;
    activeSiteName?: string | null;
    asOf?: string;
    expiringDays?: number;
    category?: string;
  };
  lines?: string[];
  kpis?: {
    employeesWithMissing: number;
    employeesWithOverdue: number;
    employeesWithExpiring: number;
    employeesWithAnyIssue: number;
    totalEmployeesInScope: number;
  };
  topRiskItems?: Array<{
    compliance_code: string;
    compliance_name: string;
    category: string;
    missingCount: number;
    overdueCount: number;
    expiringCount: number;
    affectedEmployees: number;
  }>;
  upcomingExpirations?: Array<{
    employee_id: string;
    employee_name: string;
    employee_number: string | null;
    employee_line: string | null;
    employee_site_id: string | null;
    compliance_code: string;
    compliance_name: string;
    category: string;
    valid_to: string;
    days_left: number;
  }>;
  actionsSnapshot?: {
    openActionsCount: number;
    overdueActionsCount: number;
    due7dActionsCount: number;
    recentDoneActionsCount: number;
    openActions?: unknown[];
  };
  error?: string;
  step?: string;
};

type RecommendPreviewItem = {
  employee_id: string;
  employee_name: string;
  compliance_code: string;
  compliance_name: string;
  reason: "overdue" | "missing" | "expiring";
  action_type: string;
  due_date: string;
};

type RecommendPreviewResponse = {
  ok: boolean;
  context?: { activeSiteId?: string | null; activeSiteName?: string | null; asOf?: string; expiringDays?: number };
  counts?: { willCreateTotal: number; skippedExistingTotal: number };
  byType?: { request_renewal: number; request_evidence: number; notify_employee: number };
  preview?: RecommendPreviewItem[];
  error?: string;
  step?: string;
};

const EXPIRING_DAYS_OPTIONS = [7, 14, 30, 60];
const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "license", label: "Licenses" },
  { value: "medical", label: "Medical" },
  { value: "contract", label: "Contract" },
] as const;

export default function ComplianceSummaryPage() {
  const { isAdminOrHr } = useOrg();
  const canWrite = isAdminOrHr;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [expiringDays, setExpiringDays] = useState(30);
  const [category, setCategory] = useState<string>("all");
  const [line, setLine] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [drawerEmployee, setDrawerEmployee] = useState<{
    id: string;
    name: string;
    number: string;
  } | null>(null);
  const [recommendModalOpen, setRecommendModalOpen] = useState(false);
  const [recommendPreview, setRecommendPreview] = useState<RecommendPreviewResponse | null>(null);
  const [recommendPreviewLoading, setRecommendPreviewLoading] = useState(false);
  const [recommendCommitLoading, setRecommendCommitLoading] = useState(false);
  const [digestLatest, setDigestLatest] = useState<{
    digest_date: string;
    created_at: string;
    kpis?: { open: number; overdue: number; due7d: number; nodue: number; unassigned: number; withEvidence: number; withoutEvidence: number };
    links?: { inboxOverdue: string; inboxDue7d: string; inboxUnassigned: string; summary: string };
  } | null>(null);
  const { toast } = useToast();

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("expiringDays", String(expiringDays));
    if (category !== "all") params.set("category", category);
    if (line) params.set("line", line);
    if (searchDebounced.trim()) params.set("q", searchDebounced.trim());
    return params;
  }, [expiringDays, category, line, searchDebounced]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const res = await fetch(`/api/compliance/summary?${params}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as SummaryResponse;
      if (!res.ok || !json.ok) {
        const err = json as { error?: string; step?: string };
        setError(err.error ?? (err.step ? `${err.step}: failed` : "Failed to load summary"));
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadDigestLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/digest/latest", {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as {
        ok: boolean;
        digest?: {
          digest_date: string;
          created_at: string;
          kpis?: { open: number; overdue: number; due7d: number; nodue: number; unassigned: number; withEvidence: number; withoutEvidence: number };
          links?: { inboxOverdue: string; inboxDue7d: string; inboxUnassigned: string; summary: string };
        } | null;
      };
      if (res.ok && json.ok && json.digest) setDigestLatest(json.digest);
      else setDigestLatest(null);
    } catch {
      setDigestLatest(null);
    }
  }, []);

  useEffect(() => {
    if (canWrite) loadDigestLatest();
  }, [canWrite, loadDigestLatest]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleRowClick = useCallback((employeeId: string, name: string, number: string) => {
    setDrawerEmployee({ id: employeeId, name, number });
  }, []);

  const fetchRecommendPreview = useCallback(async () => {
    setRecommendPreviewLoading(true);
    setRecommendPreview(null);
    try {
      const body = {
        expiringDays,
        category: category === "all" ? undefined : category,
        line: line || undefined,
        q: searchDebounced.trim() || undefined,
      };
      const res = await fetch("/api/compliance/actions/recommend/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as RecommendPreviewResponse;
      if (res.ok && json.ok) setRecommendPreview(json);
      else setRecommendPreview({ ok: false, error: json.error ?? "Preview failed", step: json.step });
    } catch (err) {
      setRecommendPreview({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load preview",
      });
    } finally {
      setRecommendPreviewLoading(false);
    }
  }, [expiringDays, category, line, searchDebounced]);

  const openRecommendModal = useCallback(() => {
    setRecommendModalOpen(true);
    setRecommendPreview(null);
    fetchRecommendPreview();
  }, [fetchRecommendPreview]);

  const handleRecommendCommit = useCallback(async () => {
    if (!recommendPreview?.ok) return;
    setRecommendCommitLoading(true);
    try {
      const body = {
        expiringDays,
        category: category === "all" ? undefined : category,
        line: line || undefined,
        q: searchDebounced.trim() || undefined,
        maxCreate: 200,
      };
      const res = await fetch("/api/compliance/actions/recommend/commit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; createdCount?: number; skippedCount?: number; error?: string };
      if (res.ok && json.ok) {
        toast({ title: "Actions created", description: `${json.createdCount ?? 0} recommended actions created.` });
        setRecommendModalOpen(false);
        loadSummary();
      } else {
        toast({ title: "Error", description: json.error ?? "Commit failed", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Commit failed",
        variant: "destructive",
      });
    } finally {
      setRecommendCommitLoading(false);
    }
  }, [recommendPreview, expiringDays, category, line, searchDebounced, toast, loadSummary]);

  const kpis = data?.kpis ?? {
    employeesWithMissing: 0,
    employeesWithOverdue: 0,
    employeesWithExpiring: 0,
    employeesWithAnyIssue: 0,
    totalEmployeesInScope: 0,
  };
  const actionsSnap = data?.actionsSnapshot ?? {
    openActionsCount: 0,
    overdueActionsCount: 0,
    due7dActionsCount: 0,
    recentDoneActionsCount: 0,
  };
  const topRiskItems = data?.topRiskItems ?? [];
  const upcoming = data?.upcomingExpirations ?? [];
  const lines = data?.lines ?? [];

  return (
    <OrgGuard>
      <div className="max-w-full mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Compliance Summary</h1>
            <p className="text-sm text-muted-foreground">Risk and expirations overview</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal text-muted-foreground">
              Site: {data?.context?.activeSiteId ? (data?.context?.activeSiteName ?? "Unknown site") : "All"}
            </Badge>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={String(expiringDays)} onValueChange={(v) => setExpiringDays(parseInt(v, 10))}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRING_DAYS_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}d window
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div role="tablist" className="inline-flex rounded-md border bg-muted/30 p-0.5">
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  category === value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {lines.length > 0 && (
            <Select value={line || "__all__"} onValueChange={(v) => setLine(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Line" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All lines</SelectItem>
                {lines.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card className="border-red-200 dark:border-red-900/50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold tabular-nums">{kpis.employeesWithAnyIssue}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Any issues
                  </p>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-900/50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold tabular-nums">{kpis.employeesWithOverdue}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <FileX2 className="h-3 w-3" /> Overdue
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold tabular-nums">{kpis.employeesWithMissing}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Missing</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 dark:border-amber-900/50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold tabular-nums">{kpis.employeesWithExpiring}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Expiring &lt;{data?.context?.expiringDays ?? 30}d
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold tabular-nums">{actionsSnap.openActionsCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3" /> Open actions
                  </p>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              {kpis.totalEmployeesInScope} employees in scope
            </p>

            {digestLatest && (
              <Card className="border-muted">
                <CardContent className="pt-4">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Latest digest
                    <span className="text-xs font-normal text-muted-foreground">
                      ({digestLatest.digest_date})
                    </span>
                  </h3>
                  {digestLatest.kpis && (
                    <div className="flex flex-wrap gap-3 text-sm mb-3">
                      <span>Open: <strong>{digestLatest.kpis.open}</strong></span>
                      <span>Overdue: <strong className="text-destructive">{digestLatest.kpis.overdue}</strong></span>
                      <span>Due &lt;7d: <strong>{digestLatest.kpis.due7d}</strong></span>
                      <span>No due: <strong>{digestLatest.kpis.nodue}</strong></span>
                      <span>Unassigned: <strong>{digestLatest.kpis.unassigned}</strong></span>
                      <span>With evidence: <strong>{digestLatest.kpis.withEvidence}</strong></span>
                      <span>Without evidence: <strong>{digestLatest.kpis.withoutEvidence}</strong></span>
                    </div>
                  )}
                  {digestLatest.links && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={digestLatest.links.inboxOverdue}>Overdue</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={digestLatest.links.inboxDue7d}>Due 7d</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={digestLatest.links.inboxUnassigned}>Unassigned</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={digestLatest.links.summary}>Summary</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-medium mb-3">Top risk items</h3>
                  {topRiskItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No risk items.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Item</th>
                            <th className="text-right py-2 font-medium w-14">Miss</th>
                            <th className="text-right py-2 font-medium w-14">Over</th>
                            <th className="text-right py-2 font-medium w-14">Exp</th>
                            <th className="text-right py-2 font-medium w-16">Affected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topRiskItems.map((r) => (
                            <tr key={r.compliance_code} className="border-b border-border/50">
                              <td className="py-2">
                                <span className="font-medium">{r.compliance_code}</span>
                                <span className="text-muted-foreground"> – {r.compliance_name}</span>
                              </td>
                              <td className="text-right tabular-nums">{r.missingCount}</td>
                              <td className="text-right tabular-nums">{r.overdueCount}</td>
                              <td className="text-right tabular-nums">{r.expiringCount}</td>
                              <td className="text-right tabular-nums font-medium">{r.affectedEmployees}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-medium mb-3">Upcoming expirations</h3>
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">None in the next {data?.context?.expiringDays ?? 30} days.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Employee</th>
                            <th className="text-left py-2 font-medium">Item</th>
                            <th className="text-right py-2 font-medium">Valid to</th>
                            <th className="text-right py-2 font-medium w-16">Days</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcoming.map((u, idx) => (
                            <tr
                              key={`${u.employee_id}-${u.compliance_code}-${idx}`}
                              className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() =>
                                handleRowClick(u.employee_id, u.employee_name, u.employee_number ?? "")
                              }
                            >
                              <td className="py-2">
                                <span className="font-medium">{u.employee_name}</span>
                                {u.employee_number && (
                                  <span className="text-xs text-muted-foreground block">#{u.employee_number}</span>
                                )}
                              </td>
                              <td className="py-2 text-muted-foreground">
                                {u.compliance_code} – {u.compliance_name}
                              </td>
                              <td className="py-2 text-right">
                                {new Date(u.valid_to).toLocaleDateString()}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                <Badge variant={u.days_left <= 7 ? "destructive" : "secondary"}>
                                  {u.days_left}d
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-3">Actions snapshot</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm">
                    Open: <strong>{actionsSnap.openActionsCount}</strong>
                  </span>
                  <span className="text-sm">
                    Overdue: <strong className="text-destructive">{actionsSnap.overdueActionsCount}</strong>
                  </span>
                  <span className="text-sm">
                    Due &lt;7d: <strong>{actionsSnap.due7dActionsCount}</strong>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Done last 7d: {actionsSnap.recentDoneActionsCount}
                  </span>
                  <Button size="sm" variant="secondary" onClick={openRecommendModal} className="ml-auto">
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Generate recommended actions
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/app/compliance/actions?status=open">
                      <Inbox className="h-4 w-4 mr-1.5" />
                      Go to Action Inbox
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={recommendModalOpen} onOpenChange={setRecommendModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Generate recommended actions</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 min-h-0 space-y-4">
              {recommendPreviewLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {!recommendPreviewLoading && recommendPreview && !recommendPreview.ok && (
                <>
                  <p className="text-sm text-destructive">{recommendPreview.error ?? "Preview failed"}</p>
                  <DialogFooter>
                    <Button onClick={() => setRecommendModalOpen(false)}>Close</Button>
                  </DialogFooter>
                </>
              )}
              {!recommendPreviewLoading && recommendPreview?.ok && (
                <>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>
                      Will create: <strong>{recommendPreview.counts?.willCreateTotal ?? 0}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Skipped (already open): <strong>{recommendPreview.counts?.skippedExistingTotal ?? 0}</strong>
                    </span>
                    {recommendPreview.byType && (
                      <span>
                        By type: request_renewal {recommendPreview.byType.request_renewal}, request_evidence{" "}
                        {recommendPreview.byType.request_evidence}, notify_employee {recommendPreview.byType.notify_employee}
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">Employee</th>
                          <th className="text-left py-2 px-2 font-medium">Compliance</th>
                          <th className="text-left py-2 px-2 font-medium w-24">Reason</th>
                          <th className="text-left py-2 px-2 font-medium w-32">Action type</th>
                          <th className="text-right py-2 px-2 font-medium">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(recommendPreview.preview ?? []).map((row, idx) => (
                          <tr key={`${row.employee_id}-${row.compliance_code}-${idx}`} className="border-b border-border/50">
                            <td className="py-2 px-2">{row.employee_name}</td>
                            <td className="py-2 px-2">
                              {row.compliance_code} – {row.compliance_name}
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant="secondary">{row.reason}</Badge>
                            </td>
                            <td className="py-2 px-2">{row.action_type.replace(/_/g, " ")}</td>
                            <td className="py-2 px-2 text-right">{new Date(row.due_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(recommendPreview.counts?.willCreateTotal ?? 0) > (recommendPreview.preview ?? []).length && (
                    <p className="text-xs text-muted-foreground">
                      Showing first {(recommendPreview.preview ?? []).length} of {recommendPreview.counts?.willCreateTotal ?? 0} recommendations.
                    </p>
                  )}
                </>
              )}
            </div>
            {recommendPreview?.ok && (recommendPreview.counts?.willCreateTotal ?? 0) > 0 && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setRecommendModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRecommendCommit} disabled={recommendCommitLoading}>
                  {recommendCommitLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create actions
                </Button>
              </DialogFooter>
            )}
            {recommendPreview?.ok && (recommendPreview.counts?.willCreateTotal ?? 0) === 0 && (
              <DialogFooter>
                <Button onClick={() => setRecommendModalOpen(false)}>Close</Button>
                <Button asChild>
                  <Link href="/app/compliance/actions?status=open">Go to Action Inbox</Link>
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        <ComplianceDrawer
          open={!!drawerEmployee}
          onOpenChange={(open) => !open && setDrawerEmployee(null)}
          employeeId={drawerEmployee?.id ?? null}
          employeeName={drawerEmployee?.name ?? ""}
          employeeNumber={drawerEmployee?.number ?? ""}
          isAdminOrHr={!!canWrite}
          onSaved={() => loadSummary()}
          posterContext={null}
          activeSiteId={data?.context?.activeSiteId ?? null}
          activeSiteName={data?.context?.activeSiteName ?? null}
        />
      </div>
    </OrgGuard>
  );
}
