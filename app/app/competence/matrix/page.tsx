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
import { Loader2, Search } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { cn } from "@/lib/utils";

type OverviewRow = {
  employee_id: string;
  employee_no: string;
  name: string;
  line: string | null;
  missing_count: number;
  below_required_count: number;
  status: "CRITICAL" | "RISK" | "OK";
};

type OverviewResponse = {
  ok: boolean;
  site?: { id: string; name: string } | null;
  kpis?: {
    critical_gaps: number;
    at_risk: number;
    coverage_percent: number;
    top_missing_skills: { skill_code: string; skill_name?: string; count: number }[];
  };
  rows?: OverviewRow[];
  error?: string;
  step?: string;
};

type MandatoryItem = {
  skill_code: string;
  skill_name: string;
  required_level: number;
  current_level: number | null;
  status: "OK" | "RISK" | "CRITICAL";
};

type ActivityItem = {
  id: string;
  created_at: string;
  action_type: string;
  payload: Record<string, unknown>;
};

type EmployeeResponse = {
  ok: boolean;
  employee?: { id: string; employee_no: string; name: string; line: string | null };
  mandatory?: MandatoryItem[];
  activity?: ActivityItem[];
  error?: string;
  step?: string;
};

const STATUS_STYLES: Record<"CRITICAL" | "RISK" | "OK", string> = {
  CRITICAL: "bg-red-600/15 text-red-700 border border-red-200",
  RISK: "bg-orange-500/15 text-orange-700 border border-orange-200",
  OK: "bg-emerald-500/15 text-emerald-700 border border-emerald-200",
};

const MANDATORY_STATUS_STYLES: Record<"OK" | "RISK" | "CRITICAL", string> = {
  CRITICAL: "bg-red-600/15 text-red-700 border border-red-200",
  RISK: "bg-orange-500/15 text-orange-700 border border-orange-200",
  OK: "bg-emerald-500/15 text-emerald-700 border border-emerald-200",
};

function StatusBadge({ status }: { status: "CRITICAL" | "RISK" | "OK" }) {
  return (
    <Badge className={cn("font-medium tracking-wide", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

function MandatoryStatusBadge({ status }: { status: MandatoryItem["status"] }) {
  return (
    <Badge className={cn("font-medium", MANDATORY_STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

function coverageColor(pct: number): string {
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 70) return "text-amber-600";
  return "text-red-600";
}

const ACTION_TYPES = [
  { type: "log_decision", label: "Log Decision", primary: false },
  { type: "create_training", label: "Create Training", primary: true },
  { type: "assign_mentor", label: "Assign Mentor", primary: false },
  { type: "mark_exception", label: "Mark Exception", primary: false },
] as const;

const ACTION_LABELS: Record<string, string> = {
  log_decision: "Log Decision",
  create_training: "Create Training",
  assign_mentor: "Assign Mentor",
  mark_exception: "Mark Exception",
};

export default function CompetenceMatrixPage() {
  const { toast } = useToast();
  const listSectionRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [drawerEmployee, setDrawerEmployee] = useState<{
    id: string;
    name: string;
    number: string;
    line: string | null;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerMandatory, setDrawerMandatory] = useState<MandatoryItem[]>([]);
  const [drawerActivity, setDrawerActivity] = useState<ActivityItem[]>([]);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competence/overview", {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as OverviewResponse;
      if (!res.ok || !json.ok) {
        setError(json.error ?? (json.step ? `${json.step}: failed` : "Failed to load competence board"));
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load competence board");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!drawerEmployee) {
      setDrawerMandatory([]);
      setDrawerActivity([]);
      return;
    }
    let active = true;
    setDrawerLoading(true);
    setDrawerError(null);
    fetch(`/api/competence/employee?employee_id=${drawerEmployee.id}`, {
      credentials: "include",
      headers: withDevBearer(),
    })
      .then(async (res) => {
        const json = (await res.json()) as EmployeeResponse;
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? (json.step ? `${json.step}: failed` : "Failed to load employee"));
        }
        if (active) {
          setDrawerMandatory(json.mandatory ?? []);
          setDrawerActivity(json.activity ?? []);
        }
      })
      .catch((err) => {
        if (active) setDrawerError(err instanceof Error ? err.message : "Failed to load employee");
      })
      .finally(() => {
        if (active) setDrawerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [drawerEmployee]);

  const rows = data?.rows ?? [];

  const { lineOptions, filteredRows } = useMemo(() => {
    const lines = new Set<string>();
    for (const r of rows) {
      if (r.line?.trim()) lines.add(r.line.trim());
    }
    let list = rows;
    if (lineFilter) list = list.filter((r) => r.line === lineFilter);
    if (criticalOnly) list = list.filter((r) => r.status === "CRITICAL");
    const searchLower = searchDebounced.toLowerCase().trim();
    if (searchLower) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          (r.employee_no && r.employee_no.toLowerCase().includes(searchLower))
      );
    }
    return {
      lineOptions: Array.from(lines).sort(),
      filteredRows: list,
    };
  }, [rows, lineFilter, criticalOnly, searchDebounced]);

  const handleDrawerAction = useCallback(
    async (action_type: string) => {
      if (!drawerEmployee) return;
      const label = ACTION_LABELS[action_type] ?? action_type;
      setActionPending(action_type);
      try {
        const res = await fetch("/api/competence/actions", {
          method: "POST",
          credentials: "include",
          headers: withDevBearer({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            employee_id: drawerEmployee.id,
            action_type,
            payload: { source: "competence_matrix_drawer" },
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          toast({ title: json.error ?? "Action failed", variant: "destructive" });
          return;
        }
        toast({ title: "Action logged" });
        setDrawerActivity((prev) => [
          {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            action_type,
            payload: {},
          },
          ...prev,
        ]);
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Action failed", variant: "destructive" });
      } finally {
        setActionPending(null);
      }
    },
    [drawerEmployee, toast]
  );

  const kpis = data?.kpis ?? {
    critical_gaps: 0,
    at_risk: 0,
    coverage_percent: 100,
    top_missing_skills: [],
  };

  return (
    <OrgGuard>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Competence Matrix 2.0 Executive Board</h1>
            <Badge variant="secondary" className="font-normal text-muted-foreground">
              {data?.site ? data.site.name : "Active site"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Executive snapshot of skill coverage, gaps, and critical risks.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Critical gaps</div>
            <div className="mt-2 text-3xl font-semibold text-red-600">{kpis.critical_gaps}</div>
            <div className="text-xs text-muted-foreground mt-1">Employees with mandatory requirement not met</div>
          </Card>
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">At risk</div>
            <div className="mt-2 text-3xl font-semibold text-orange-600">{kpis.at_risk}</div>
            <div className="text-xs text-muted-foreground mt-1">Near-miss or missing rating on mandatory</div>
          </Card>
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Coverage %</div>
            <div className={cn("mt-2 text-3xl font-semibold", coverageColor(kpis.coverage_percent))}>
              {kpis.coverage_percent}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Employees meeting all mandatory requirements</div>
          </Card>
          <Card className="p-4 shadow-sm rounded-lg bg-card/95">
            <div className="text-xs uppercase text-muted-foreground">Top missing skills</div>
            <div className="mt-2 text-sm font-medium">
              {kpis.top_missing_skills.length === 0
                ? "—"
                : kpis.top_missing_skills.map((s) => `${s.skill_name ?? s.skill_code} (${s.count})`).join(", ")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">By gap count</div>
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
            <Button
              variant={criticalOnly ? "secondary" : "ghost"}
              size="sm"
              className="h-9"
              onClick={() => setCriticalOnly((v) => !v)}
            >
              Show only critical
            </Button>
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

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-lg bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No competence data available. Mandatory requirements may be unconfigured.
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
              No employees match the current filters.
            </div>
          ) : (
            filteredRows.map((row) => (
              <Card
                key={row.employee_id}
                className="rounded-xl bg-card/95 px-4 py-3 shadow-sm transition hover:shadow-md cursor-pointer border-0"
                onClick={() =>
                  setDrawerEmployee({
                    id: row.employee_id,
                    name: row.name,
                    number: row.employee_no,
                    line: row.line ?? null,
                  })
                }
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.employee_no ? `#${row.employee_no}` : "No employee number"}
                    </div>
                  </div>
                  <div className="text-muted-foreground text-sm">{row.line ?? "N/A"}</div>
                  <div className="flex gap-6 text-center tabular-nums text-sm">
                    <span className="font-semibold text-red-600">{row.missing_count}</span>
                    <span className="font-semibold text-orange-600">{row.below_required_count}</span>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              </Card>
            ))
          )}
        </div>

        <Sheet
          open={!!drawerEmployee}
          onOpenChange={(open) => {
            if (!open) {
              setDrawerEmployee(null);
              setDrawerMandatory([]);
              setDrawerError(null);
              setDrawerActivity([]);
            }
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
            <SheetHeader>
              <SheetTitle>{drawerEmployee?.name ?? "Employee"}</SheetTitle>
              <SheetDescription>
                {drawerEmployee?.number ? `#${drawerEmployee.number}` : "No employee number"}
                {drawerEmployee?.line ? ` | ${drawerEmployee.line}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              <section className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mandatory requirements
                </div>
                {drawerLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : drawerError ? (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {drawerError}
                  </div>
                ) : drawerMandatory.length === 0 ? (
                  <div className="rounded-lg bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    No mandatory requirements for this role (or no station/line mapping).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drawerMandatory.map((item) => (
                      <div key={item.skill_code} className="rounded-lg bg-muted/20 px-3 py-2 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-foreground">{item.skill_name}</div>
                            <div className="text-xs text-muted-foreground">{item.skill_code}</div>
                          </div>
                          <MandatoryStatusBadge status={item.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Required: {item.required_level} · Current: {item.current_level ?? "Missing"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {drawerActivity.length > 0 && (
                <section className="space-y-2 pt-2 border-t border-border">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Activity
                  </div>
                  <ul className="space-y-1.5">
                    {drawerActivity.map((a) => (
                      <li key={a.id} className="text-xs text-muted-foreground">
                        {ACTION_LABELS[a.action_type] ?? a.action_type} — {new Date(a.created_at).toLocaleString()}
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
                      onClick={() => handleDrawerAction(type)}
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
