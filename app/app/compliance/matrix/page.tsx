"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrgGuard } from "@/components/OrgGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { cn } from "@/lib/utils";

type OverviewRow = {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  line: string | null;
  department: string | null;
  compliance_id: string;
  compliance_code: string;
  compliance_name: string;
  category: string;
  status: string;
  valid_to: string | null;
  days_left: number | null;
};

type OverviewResponse = {
  ok: boolean;
  rows?: OverviewRow[];
  activeSiteId?: string | null;
  activeSiteName?: string | null;
  error?: string;
  step?: string;
};

type EmployeeComplianceItem = {
  compliance_id: string;
  category: string;
  code: string;
  name: string;
  status: "valid" | "expiring" | "expired" | "missing" | "waived";
  valid_from: string | null;
  valid_to: string | null;
  evidence_url: string | null;
  notes: string | null;
  waived: boolean;
  days_left: number | null;
};

type EmployeeComplianceResponse = {
  ok: boolean;
  items?: EmployeeComplianceItem[];
  error?: string;
  step?: string;
};

type RiskStatus = "LEGAL_STOP" | "RISK" | "WARNING" | "OK";

type RiskRow = {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  line: string | null;
  department: string | null;
  expired_count: number;
  expiring_count: number;
  missing_count: number;
  risk_score: number;
  status: RiskStatus;
};

type DrawerActivityItem = {
  id: string;
  action_type: string;
  at: string;
  label: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  license: "Licenses",
  medical: "Medical",
  contract: "Contract",
  customer_requirement: "Customer requirement",
  work_environment: "Work environment",
};

const RISK_STATUS_STYLES: Record<RiskStatus, string> = {
  LEGAL_STOP: "bg-red-600/15 text-red-700 border border-red-200",
  RISK: "bg-orange-500/15 text-orange-700 border border-orange-200",
  WARNING: "bg-amber-500/15 text-amber-700 border border-amber-200",
  OK: "bg-emerald-500/15 text-emerald-700 border border-emerald-200",
};

const ITEM_STATUS_STYLES: Record<EmployeeComplianceItem["status"], string> = {
  expired: "bg-red-600/15 text-red-700 border border-red-200",
  missing: "bg-orange-500/15 text-orange-700 border border-orange-200",
  expiring: "bg-amber-500/15 text-amber-700 border border-amber-200",
  valid: "bg-emerald-500/15 text-emerald-700 border border-emerald-200",
  waived: "bg-slate-500/10 text-slate-600 border border-slate-200",
};

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft == null) return "";
  if (daysLeft < 0) return `${Math.abs(daysLeft)} days overdue`;
  return `${daysLeft} days left`;
}

function compliantPercentColor(pct: number): string {
  if (pct <= 0) return "text-red-600";
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 70) return "text-orange-600";
  return "text-red-600";
}

function RiskStatusBadge({ status }: { status: RiskStatus }) {
  return (
    <Badge className={cn("font-medium tracking-wide", RISK_STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

function ItemStatusBadge({ status }: { status: EmployeeComplianceItem["status"] }) {
  return (
    <Badge className={cn("font-medium", ITEM_STATUS_STYLES[status])}>
      {status.toUpperCase()}
    </Badge>
  );
}

const ACTION_TYPES = [
  { type: "create_hr_task", label: "Create HR Task", primary: true },
  { type: "send_reminder", label: "Send Reminder", primary: false },
  { type: "assign_manager", label: "Assign Manager", primary: false },
  { type: "mark_exception", label: "Mark Exception", primary: false },
  { type: "log_decision", label: "Log Decision", primary: false },
] as const;

export default function ComplianceMatrixPage() {
  const { toast } = useToast();
  const listSectionRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<RiskStatus | "">("");
  const [drawerEmployee, setDrawerEmployee] = useState<{
    id: string;
    name: string;
    number: string;
    line: string | null;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerItems, setDrawerItems] = useState<EmployeeComplianceItem[]>([]);
  const [drawerActivity, setDrawerActivity] = useState<DrawerActivityItem[]>([]);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await fetch(`/api/compliance/overview?${params}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as OverviewResponse;
      if (!res.ok || !json.ok) {
        const err = json as { error?: string; step?: string };
        setError(err.error ?? (err.step ? `${err.step}: failed` : "Failed to load compliance board"));
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load compliance board");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!drawerEmployee) {
      setDrawerActivity([]);
      return;
    }
    let active = true;
    setDrawerLoading(true);
    setDrawerError(null);
    fetch(`/api/compliance/employee?employeeId=${drawerEmployee.id}`, {
      credentials: "include",
      headers: withDevBearer(),
    })
      .then(async (res) => {
        const json = (await res.json()) as EmployeeComplianceResponse;
        if (!res.ok || !json.ok) {
          const err = json as { error?: string; step?: string };
          throw new Error(err.error ?? (err.step ? `${err.step}: failed` : "Failed to load employee compliance"));
        }
        if (active) setDrawerItems(json.items ?? []);
      })
      .catch((err) => {
        if (active) setDrawerError(err instanceof Error ? err.message : "Failed to load employee compliance");
      })
      .finally(() => {
        if (active) setDrawerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [drawerEmployee]);

  const rows = data?.rows ?? [];

  const { lineOptions, riskRows, kpis } = useMemo(() => {
    const lines = new Set<string>();
    const byEmployee = new Map<string, Omit<RiskRow, "status" | "risk_score">>();

    for (const row of rows) {
      if (row.line?.trim()) lines.add(row.line.trim());
      if (lineFilter && row.line !== lineFilter) continue;

      const current = byEmployee.get(row.employee_id);
      if (!current) {
        byEmployee.set(row.employee_id, {
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_number: row.employee_number ?? "",
          line: row.line ?? null,
          department: row.department ?? null,
          expired_count: 0,
          expiring_count: 0,
          missing_count: 0,
        });
      }

      const target = byEmployee.get(row.employee_id)!;
      if (row.status === "expired") target.expired_count += 1;
      else if (row.status === "expiring") target.expiring_count += 1;
      else if (row.status === "missing") target.missing_count += 1;
    }

    const riskRowsList: RiskRow[] = Array.from(byEmployee.values()).map((row) => {
      const status: RiskStatus =
        row.expired_count > 0
          ? "LEGAL_STOP"
          : row.missing_count > 0
            ? "RISK"
            : row.expiring_count > 0
              ? "WARNING"
              : "OK";
      const risk_score = row.expired_count * 5 + row.missing_count * 2 + row.expiring_count * 1;
      return { ...row, status, risk_score };
    });

    riskRowsList.sort((a, b) => {
      if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
      if (b.expired_count !== a.expired_count) return b.expired_count - a.expired_count;
      if (b.missing_count !== a.missing_count) return b.missing_count - a.missing_count;
      if (b.expiring_count !== a.expiring_count) return b.expiring_count - a.expiring_count;
      return a.employee_name.localeCompare(b.employee_name);
    });

    const totalEmployees = byEmployee.size;
    const employeesWithIssues = new Set<string>(
      riskRowsList.filter((r) => r.status !== "OK").map((r) => r.employee_id)
    );
    const compliantEmployees = totalEmployees - employeesWithIssues.size;
    const compliantPercent = totalEmployees > 0 ? Math.round((compliantEmployees / totalEmployees) * 100) : 0;

    return {
      lineOptions: Array.from(lines).sort(),
      riskRows: riskRowsList,
      kpis: {
        legal_blockers: riskRowsList.filter((r) => r.status === "LEGAL_STOP").length,
        expiring_30: riskRowsList.filter((r) => r.status === "WARNING").length,
        missing_mandatory: riskRowsList.filter((r) => r.status === "RISK").length,
        compliant_percent: compliantPercent,
        total_employees: totalEmployees,
        compliant_employees: compliantEmployees,
      },
    };
  }, [rows, lineFilter]);

  const filteredRiskRows = useMemo(() => {
    if (!statusFilter) return riskRows;
    return riskRows.filter((r) => r.status === statusFilter);
  }, [riskRows, statusFilter]);

  const groupedDrawerItems = useMemo(() => {
    const groups: Record<string, EmployeeComplianceItem[]> = {};
    for (const item of drawerItems) {
      const key = item.category || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    const order = ["license", "medical", "contract", "customer_requirement", "work_environment"];
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const score = (s: EmployeeComplianceItem["status"]) =>
          s === "expired" ? 3 : s === "missing" ? 2 : s === "expiring" ? 1 : 0;
        const diff = score(b.status) - score(a.status);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
    }
    const ordered: Array<[string, EmployeeComplianceItem[]]> = [];
    for (const key of order) {
      if (groups[key]) ordered.push([key, groups[key]]);
    }
    for (const key of Object.keys(groups)) {
      if (!order.includes(key)) ordered.push([key, groups[key]]);
    }
    return ordered;
  }, [drawerItems]);

  const hasExpiredInDrawer = useMemo(
    () => drawerItems.some((i) => i.status === "expired"),
    [drawerItems]
  );

  const handleReviewBlockers = useCallback(() => {
    setStatusFilter("LEGAL_STOP");
    listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDrawerAction = useCallback(
    async (action_type: string, label: string) => {
      if (!drawerEmployee) return;
      setActionPending(action_type);
      try {
        const res = await fetch("/api/compliance/actions", {
          method: "POST",
          credentials: "include",
          headers: withDevBearer({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            employee_id: drawerEmployee.id,
            action_type,
            payload: { source: "compliance_matrix_drawer" },
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          toast({ title: json.error ?? "Action failed", variant: "destructive" });
          return;
        }
        toast({ title: label });
        setDrawerActivity((prev) => [
          ...prev,
          { id: crypto.randomUUID(), action_type, at: new Date().toISOString(), label },
        ]);
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Action failed", variant: "destructive" });
      } finally {
        setActionPending(null);
      }
    },
    [drawerEmployee, toast]
  );

  const hasRows = rows.length > 0;

  return (
    <OrgGuard>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Compliance 2.0 Executive Board</h1>
            <Badge variant="secondary" className="font-normal text-muted-foreground">
              Site: {data?.activeSiteId ? (data?.activeSiteName ?? "Unknown site") : "All"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Executive snapshot of legal blockers, expirations, and employee risk posture.
          </p>
        </header>

        {kpis.legal_blockers > 0 && (
          <Card className="border-red-200 bg-red-50/80 dark:bg-red-950/20 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                {kpis.legal_blockers} Legal blocker{kpis.legal_blockers !== 1 ? "s" : ""} detected
              </div>
              <p className="text-sm text-red-700/90 dark:text-red-300/90 mt-1">
                These employees cannot legally operate.
              </p>
            </div>
            <Button onClick={handleReviewBlockers} variant="destructive" size="sm" className="shrink-0">
              Review blockers
            </Button>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="md:col-span-2 p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Legal blockers</div>
            <div className="mt-2 text-3xl font-semibold text-red-600">{kpis.legal_blockers}</div>
            <div className="text-xs text-muted-foreground mt-1">Employees with expired mandatory items</div>
          </Card>
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Expiring 30 days</div>
            <div className="mt-2 text-3xl font-semibold text-amber-600">{kpis.expiring_30}</div>
            <div className="text-xs text-muted-foreground mt-1">Employees with upcoming expirations</div>
          </Card>
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Missing mandatory</div>
            <div className="mt-2 text-3xl font-semibold text-orange-600">{kpis.missing_mandatory}</div>
            <div className="text-xs text-muted-foreground mt-1">Employees missing required items</div>
          </Card>
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Compliant</div>
            <div className={cn("mt-2 text-3xl font-semibold", compliantPercentColor(kpis.compliant_percent))}>
              {kpis.compliant_percent}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.compliant_employees} of {kpis.total_employees} employees
            </div>
          </Card>
        </div>

        <div
          className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-y border-border/40"
          ref={listSectionRef}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee name or #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={lineFilter || "__all__"} onValueChange={(v) => setLineFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All lines</SelectItem>
                {lineOptions.map((line) => (
                  <SelectItem key={line} value={line}>
                    {line}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => setStatusFilter("")}
              >
                Clear status filter
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-sm">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => loadBoard()}>
              Retry
            </Button>
          </Card>
        )}

        {!loading && !error && !hasRows && (
          <div className="rounded-lg bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No compliance data available for the current site.
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            filteredRiskRows.length === 0 ? (
              <div className="rounded-lg bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No employees match the current filters.
              </div>
            ) : (
              filteredRiskRows.map((row) => (
                <Card
                  key={row.employee_id}
                  className="rounded-xl bg-card/95 px-4 py-3 shadow-sm transition hover:shadow-md cursor-pointer border-0"
                  onClick={() =>
                    setDrawerEmployee({
                      id: row.employee_id,
                      name: row.employee_name,
                      number: row.employee_number,
                      line: row.line ?? null,
                    })
                  }
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{row.employee_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.employee_number ? `#${row.employee_number}` : "No employee number"}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-sm">{row.line ?? "N/A"}</div>
                    <div className="flex gap-6 text-center tabular-nums text-sm">
                      <span className="font-semibold text-red-600">{row.expired_count}</span>
                      <span className="font-semibold text-amber-600">{row.expiring_count}</span>
                      <span className="font-semibold text-orange-600">{row.missing_count}</span>
                    </div>
                    <RiskStatusBadge status={row.status} />
                  </div>
                </Card>
              ))
            )
          )}
        </div>

        <Sheet
          open={!!drawerEmployee}
          onOpenChange={(open) => {
            if (!open) {
              setDrawerEmployee(null);
              setDrawerItems([]);
              setDrawerError(null);
              setDrawerActivity([]);
            }
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
            <SheetHeader>
              <SheetTitle>{drawerEmployee?.name ?? "Employee compliance"}</SheetTitle>
              <SheetDescription>
                {drawerEmployee?.number ? `#${drawerEmployee.number}` : "No employee number"}
                {drawerEmployee?.line ? ` | ${drawerEmployee.line}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              {hasExpiredInDrawer && (
                <div className="rounded-lg border border-red-200 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-200">
                  <strong>Why legal stop:</strong> This employee has expired mandatory compliance items and cannot legally operate until renewed.
                </div>
              )}

              {drawerLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading compliance items...
                </div>
              ) : drawerError ? (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {drawerError}
                </div>
              ) : (
                groupedDrawerItems.map(([category, items]) => (
                  <section key={category} className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABELS[category] ?? category}
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.compliance_id}
                          className="rounded-lg bg-muted/20 px-3 py-2 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-foreground">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.code}</div>
                            </div>
                            <ItemStatusBadge status={item.status} />
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            Valid to: {formatDate(item.valid_to)}
                            {item.days_left != null && ` · ${formatDaysLeft(item.days_left)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}

              {drawerActivity.length > 0 && (
                <section className="space-y-2 pt-2 border-t border-border">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Activity
                  </div>
                  <ul className="space-y-1.5">
                    {drawerActivity.map((a) => (
                      <li key={a.id} className="text-xs text-muted-foreground">
                        {a.label} — {new Date(a.at).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {drawerEmployee && (
              <div className="mt-4 pt-4 border-t border-border space-y-2 flex-shrink-0">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Actions
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACTION_TYPES.map(({ type, label, primary }) => (
                    <Button
                      key={type}
                      variant={primary ? "default" : "outline"}
                      size="sm"
                      disabled={!!actionPending}
                      onClick={() => handleDrawerAction(type, label)}
                    >
                      {actionPending === type ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </OrgGuard>
  );
}
