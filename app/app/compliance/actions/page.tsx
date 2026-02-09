"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Loader2, CheckCircle2, Calendar, UserPlus, FileText, Paperclip, Download } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ComplianceDrawer } from "@/components/compliance/ComplianceDrawer";
import { DraftModal } from "@/components/compliance/DraftModal";
import { EvidenceModal } from "@/components/compliance/EvidenceModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";

type SlaFlag = "overdue" | "due7d" | "nodue" | "ok";

type InboxAction = {
  action_id: string;
  status: string;
  action_type: string;
  due_date: string | null;
  owner_user_id: string | null;
  sla?: SlaFlag;
  notes: string | null;
  created_at: string;
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  employee_line: string | null;
  employee_site_id: string | null;
  compliance_id: string;
  compliance_code: string | null;
  compliance_name: string | null;
  compliance_category: string | null;
  site_name: string | null;
  lastDraftedAt?: string | null;
  lastDraftedBy?: string | null;
  lastDraftedChannel?: string | null;
  lastDraftedTemplateId?: string | null;
  hasEvidence?: boolean;
  evidenceAddedAt?: string | null;
  evidenceUrl?: string | null;
  evidenceNotes?: string | null;
  /** P1.9: compliance status for filter/sort (from employee_compliance) */
  compliance_status?: string;
  days_left?: number | null;
  valid_to?: string | null;
};

type InboxResponse = {
  ok: boolean;
  actions?: InboxAction[];
  activeSiteId?: string | null;
  activeSiteName?: string | null;
  kpis?: { open: number; overdue: number; due7d: number; done7d: number };
  unassignedCount?: number;
  lines?: string[];
  error?: string;
  step?: string;
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  request_renewal: "Request renewal",
  request_evidence: "Request evidence",
  notify_employee: "Notify employee",
  mark_waived_review: "Waived review",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
] as const;

const DUE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "7d", label: "<7d" },
  { value: "30d", label: "<30d" },
] as const;

const ACTION_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "request_renewal", label: "Request renewal" },
  { value: "request_evidence", label: "Request evidence" },
  { value: "notify_employee", label: "Notify employee" },
  { value: "mark_waived_review", label: "Waived review" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "license", label: "Licenses" },
  { value: "medical", label: "Medical" },
  { value: "contract", label: "Contract" },
] as const;

function relativeDraftTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}

export default function ActionInboxPage() {
  const { isAdminOrHr } = useOrg();
  const canWrite = isAdminOrHr;
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InboxResponse | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [status, setStatus] = useState<"open" | "done" | "all">("open");
  const [due, setDue] = useState<"all" | "overdue" | "7d" | "30d">("all");
  const [slaFilter, setSlaFilter] = useState<"all" | "overdue" | "due7d" | "nodue">("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "me" | "unassigned">("all");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [actionType, setActionType] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [line, setLine] = useState("");
  const [drawerEmployee, setDrawerEmployee] = useState<{
    id: string;
    name: string;
    number: string;
  } | null>(null);
  const [dueDialog, setDueDialog] = useState<{
    actionId: string;
    dueDate: string | null;
  } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [markingDoneId, setMarkingDoneId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState<InboxAction | null>(null);
  const [evidenceAction, setEvidenceAction] = useState<InboxAction | null>(null);
  const [exportChannel, setExportChannel] = useState<"email" | "sms" | "note">("email");
  const [exportLoading, setExportLoading] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<"all" | "missing_expired" | "expiring" | "waived">("all");

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("due", due);
    if (slaFilter !== "all") params.set("sla", slaFilter);
    if (ownerFilter !== "all") params.set("owner", ownerFilter);
    if (unassignedOnly) params.set("unassignedOnly", "1");
    if (actionType !== "all") params.set("actionType", actionType);
    if (category !== "all") params.set("category", category);
    if (line) params.set("line", line);
    if (searchDebounced.trim()) params.set("q", searchDebounced.trim());
    if (complianceFilter !== "all") params.set("complianceStatus", complianceFilter);
    return params;
  }, [status, due, actionType, category, line, searchDebounced, slaFilter, ownerFilter, unassignedOnly, complianceFilter]);

  const handleExportCsv = useCallback(async () => {
    setExportLoading(true);
    try {
      const params = buildParams();
      params.set("channel", exportChannel);
      params.set("limit", "500");
      const url = `/api/compliance/actions/export?${params}`;
      const res = await fetch(url, { credentials: "include", headers: withDevBearer() });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        toast({ title: "Export failed", description: json.error ?? res.statusText, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `compliance-actions-export-${new Date().toISOString().slice(0, 10)}.csv`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Export downloaded", description: filename });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Download failed",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  }, [buildParams, exportChannel, toast]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const res = await fetch(`/api/compliance/actions/inbox?${params}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as InboxResponse;
      if (!res.ok || !json.ok) {
        const err = json as { error?: string; step?: string };
        setError(err.error ?? (err.step ? `${err.step}: failed` : "Failed to load inbox"));
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
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleKpiClick = useCallback(
    (k: "open" | "overdue" | "due7d" | "done7d") => {
      if (k === "open") setStatus("open");
      else if (k === "overdue") setDue("overdue");
      else if (k === "due7d") setDue("7d");
      else if (k === "done7d") setStatus("done");
    },
    []
  );

  const handleAssignToMe = useCallback(
    async (actionId: string) => {
      if (!user?.id) {
        toast({ title: "Not signed in", variant: "destructive" });
        return;
      }
      setAssigningId(actionId);
      try {
        const res = await fetch(`/api/compliance/actions/${actionId}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...withDevBearer() },
          credentials: "include",
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast({ title: (json as { error?: string }).error ?? "Failed", variant: "destructive" });
          return;
        }
        toast({ title: "Assigned to you" });
        loadInbox();
      } catch {
        toast({ title: "Failed to assign", variant: "destructive" });
      } finally {
        setAssigningId(null);
      }
    },
    [user?.id, toast, loadInbox]
  );

  const handleSetDue = useCallback(
    async (actionId: string, dueDate: string | null) => {
      setDueDialog(null);
      try {
        const res = await fetch(`/api/compliance/actions/${actionId}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...withDevBearer() },
          credentials: "include",
          body: JSON.stringify({ due_date: dueDate }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast({ title: (json as { error?: string }).error ?? "Failed", variant: "destructive" });
          return;
        }
        toast({ title: "Due date updated" });
        loadInbox();
      } catch {
        toast({ title: "Failed to update due date", variant: "destructive" });
      }
    },
    [toast, loadInbox]
  );

  const handleMarkDone = useCallback(
    async (actionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setMarkingDoneId(actionId);
      try {
        const res = await fetch(`/api/compliance/actions/${actionId}/done`, {
          method: "POST",
          headers: withDevBearer(),
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast({ title: (json as { error?: string }).error ?? "Failed", variant: "destructive" });
          return;
        }
        toast({ title: "Marked done" });
        loadInbox();
      } catch {
        toast({ title: "Failed to mark done", variant: "destructive" });
      } finally {
        setMarkingDoneId(null);
      }
    },
    [toast, loadInbox]
  );

  const handleRowClick = useCallback((employeeId: string, name: string, number: string) => {
    setDrawerEmployee({ id: employeeId, name, number });
  }, []);

  const actions = data?.actions ?? [];
  const kpis = data?.kpis ?? { open: 0, overdue: 0, due7d: 0, done7d: 0 };
  const lines = useMemo(() => (data?.lines ?? []).filter((l) => !isLegacyLine(l)), [data?.lines]);

  return (
    <OrgGuard>
      <div className="max-w-full mx-auto px-4 py-6 space-y-6">
        {!canWrite && <p className="text-sm text-muted-foreground">Read-only.</p>}
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Action Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Execute compliance actions across employees.
          </p>
        </header>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal text-muted-foreground">
            Site: {data?.activeSiteId ? (data?.activeSiteName ?? "Unknown site") : "All"}
          </Badge>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: "open" as const, label: "Open", count: kpis.open, onClick: () => handleKpiClick("open") },
            {
              key: "overdue" as const,
              label: "Overdue",
              count: kpis.overdue,
              onClick: () => handleKpiClick("overdue"),
              className: "border-red-200 dark:border-red-900/50",
            },
            {
              key: "due7d" as const,
              label: "Due &lt;7d",
              count: kpis.due7d,
              onClick: () => handleKpiClick("due7d"),
              className: "border-amber-200 dark:border-amber-900/50",
            },
            {
              key: "done7d" as const,
              label: "Done last 7d",
              count: kpis.done7d,
              onClick: () => handleKpiClick("done7d"),
            },
          ].map(({ key, label, count, onClick, className }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className={cn(
                "text-left rounded-lg border-2 p-4 transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring",
                status === "open" && key === "open" && "ring-2 ring-offset-2 ring-primary",
                due === "overdue" && key === "overdue" && "ring-2 ring-offset-2 ring-primary",
                due === "7d" && key === "due7d" && "ring-2 ring-offset-2 ring-primary",
                status === "done" && key === "done7d" && "ring-2 ring-offset-2 ring-primary",
                className
              )}
            >
              <p className="text-2xl font-bold tabular-nums">{loading ? "—" : count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee name or #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={due} onValueChange={(v) => setDue(v as typeof due)}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DUE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* P1.9: Compliance status filter chips — Missing/Expired, Expiring soon, Waived, All */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Status:</span>
          {[
            { value: "all" as const, label: "All" },
            { value: "missing_expired" as const, label: "Missing/Expired" },
            { value: "expiring" as const, label: "Expiring soon" },
            { value: "waived" as const, label: "Waived" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setComplianceFilter(value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                complianceFilter === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 border-border hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
          {complianceFilter !== "all" && (
            <button
              type="button"
              onClick={() => setComplianceFilter("all")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Quick filters: SLA + ownership */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Quick:</span>
          <button
            type="button"
            onClick={() => setSlaFilter(slaFilter === "overdue" ? "all" : "overdue")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              slaFilter === "overdue" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            Overdue
          </button>
          <button
            type="button"
            onClick={() => setSlaFilter(slaFilter === "due7d" ? "all" : "due7d")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              slaFilter === "due7d" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            Due &lt;7d
          </button>
          <button
            type="button"
            onClick={() => setSlaFilter(slaFilter === "nodue" ? "all" : "nodue")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              slaFilter === "nodue" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            No due date
          </button>
          <button
            type="button"
            onClick={() => setOwnerFilter(ownerFilter === "unassigned" ? "all" : "unassigned")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              ownerFilter === "unassigned" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            Unassigned {((data?.unassignedCount ?? 0) > 0) && <span className="tabular-nums">({data?.unassignedCount})</span>}
          </button>
          <button
            type="button"
            onClick={() => setOwnerFilter(ownerFilter === "me" ? "all" : "me")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              ownerFilter === "me" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            Mine
          </button>
          {canWrite && (
            <>
              <span className="text-xs text-muted-foreground mx-2">|</span>
              <Select
                value={exportChannel}
                onValueChange={(v) => setExportChannel(v as "email" | "sms" | "note")}
              >
                <SelectTrigger className="w-[100px] h-9 rounded-md border px-2.5 py-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleExportCsv}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </Button>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : actions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No actions match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3 font-medium">Employee</th>
                      <th className="text-left py-2 px-3 font-medium">Line</th>
                      <th className="text-left py-2 px-3 font-medium">Compliance item</th>
                      <th className="text-left py-2 px-3 font-medium">Action type</th>
                      <th className="text-left py-2 px-3 font-medium">Due date</th>
                      <th className="text-left py-2 px-3 font-medium">Owner</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Last drafted</th>
                      <th className="text-left py-2 px-3 font-medium">Evidence</th>
                      <th className="w-[90px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a, idx) => (
                      <tr
                        key={a.action_id}
                        className={cn(
                          "border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors",
                          idx % 2 === 1 && "bg-muted/20"
                        )}
                        onClick={() => handleRowClick(a.employee_id, a.employee_name, a.employee_number ?? "")}
                      >
                        <td className="py-2 px-3">
                          <div>
                            <p className="font-medium">{a.employee_name}</p>
                            <p className="text-xs text-muted-foreground">{a.employee_number ?? "—"}</p>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{a.employee_line ?? "—"}</td>
                        <td className="py-2 px-3">
                          <div>
                            <p className="font-medium">
                              {a.compliance_code ?? "—"} – {a.compliance_name ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="font-normal">
                            {ACTION_TYPE_LABELS[a.action_type] ?? a.action_type}
                          </Badge>
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <span className={a.due_date && new Date(a.due_date) < new Date() ? "text-destructive" : ""}>
                              {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}
                            </span>
                            {a.status === "open" && canWrite && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDueDialog({
                                    actionId: a.action_id,
                                    dueDate: a.due_date,
                                  });
                                }}
                              >
                                <Calendar className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          {a.status === "open" && a.sla ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "font-normal text-xs",
                                a.sla === "overdue" && "bg-destructive/15 text-destructive border-destructive/30",
                                a.sla === "due7d" && "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
                                a.sla === "nodue" && "bg-muted text-muted-foreground",
                                a.sla === "ok" && "bg-muted/50 text-muted-foreground border-0"
                              )}
                            >
                              {a.sla === "overdue" ? "Overdue" : a.sla === "due7d" ? "Due <7d" : a.sla === "nodue" ? "No due date" : "OK"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          {a.status === "open" ? (
                            a.owner_user_id === user?.id ? (
                              <Badge variant="secondary" className="font-normal text-xs">Mine</Badge>
                            ) : a.owner_user_id ? (
                              <span className="text-xs text-muted-foreground">Assigned</span>
                            ) : canWrite ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                disabled={!!assigningId}
                                onClick={(e) => { e.stopPropagation(); handleAssignToMe(a.action_id); }}
                              >
                                {assigningId === a.action_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Assign to me
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={a.status === "done" ? "default" : "outline"}
                            className={a.status === "done" ? "bg-emerald-600" : ""}
                          >
                            {a.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {a.lastDraftedAt ? (
                            <span
                              title={`${new Date(a.lastDraftedAt).toLocaleString()}${a.lastDraftedChannel ? ` · ${a.lastDraftedChannel}` : ""}`}
                            >
                              {relativeDraftTime(a.lastDraftedAt)}
                            </span>
                          ) : (
                            "Never"
                          )}
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <TooltipProvider>
                            {a.hasEvidence ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="font-normal text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                                    Attached
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-mono text-xs break-all">{a.evidenceUrl ?? "—"}</p>
                                  {a.evidenceNotes && (
                                    <p className="text-xs text-muted-foreground mt-1">{a.evidenceNotes}</p>
                                  )}
                                  {a.evidenceAddedAt && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {new Date(a.evidenceAddedAt).toLocaleString()}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </TooltipProvider>
                          {a.status === "open" && canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 ml-1"
                              title="Attach evidence"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEvidenceAction(a);
                              }}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          {a.status === "open" && (
                            <div className="flex items-center gap-1">
                              {canWrite && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  title="Generate draft"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDraftAction(a);
                                  }}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canWrite && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8"
                                  disabled={!!markingDoneId}
                                  onClick={(e) => handleMarkDone(a.action_id, e)}
                                >
                                  {markingDoneId === a.action_id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Mark done
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <DraftModal
          open={!!draftAction}
          onOpenChange={(open) => !open && setDraftAction(null)}
          input={draftAction ? { actionId: draftAction.action_id } : null}
          activeSiteId={data?.activeSiteId ?? null}
        />

        <EvidenceModal
          open={!!evidenceAction}
          onOpenChange={(open) => !open && setEvidenceAction(null)}
          actionId={evidenceAction?.action_id ?? null}
          existingEvidence={
            evidenceAction
              ? {
                  evidence_url: evidenceAction.evidenceUrl ?? "",
                  evidence_notes: evidenceAction.evidenceNotes,
                  evidence_added_at: evidenceAction.evidenceAddedAt,
                }
              : null
          }
          onSaved={loadInbox}
        />

        <ComplianceDrawer
          open={!!drawerEmployee}
          onOpenChange={(open) => !open && setDrawerEmployee(null)}
          employeeId={drawerEmployee?.id ?? null}
          employeeName={drawerEmployee?.name ?? ""}
          employeeNumber={drawerEmployee?.number ?? ""}
          isAdminOrHr={!!canWrite}
          onSaved={() => {
            toast({ title: "Saved" });
            loadInbox();
          }}
          posterContext={null}
          activeSiteId={data?.activeSiteId ?? null}
          activeSiteName={data?.activeSiteName ?? null}
        />

        <Dialog open={!!dueDialog} onOpenChange={(open) => !open && setDueDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set due date</DialogTitle>
            </DialogHeader>
            {dueDialog && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={dueDialog.dueDate ?? ""}
                    onChange={(e) =>
                      setDueDialog((d) => (d ? { ...d, dueDate: e.target.value || null } : null))
                    }
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDueDialog(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      handleSetDue(dueDialog.actionId, dueDialog.dueDate)
                    }
                  >
                    Save
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </OrgGuard>
  );
}
