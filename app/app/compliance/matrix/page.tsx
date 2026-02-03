"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { OrgGuard } from "@/components/OrgGuard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2 } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { ComplianceDrawer } from "@/components/compliance/ComplianceDrawer";
import { cn } from "@/lib/utils";

type CategoryTab = "all" | "license" | "medical" | "contract";
type MatrixEmployee = { id: string; name: string; employee_number: string; line: string | null };
type MatrixCatalogItem = { id: string; category: string; code: string; name: string };
type MatrixCellStatus = "waived" | "missing" | "overdue" | "expiring" | "valid";
type MatrixCell = {
  employee_id: string;
  compliance_id: string;
  status: MatrixCellStatus;
  valid_to: string | null;
  days_left: number | null;
  notes: string | null;
  evidence_url: string | null;
};
type MatrixResponse = {
  ok: boolean;
  employees?: MatrixEmployee[];
  catalog?: MatrixCatalogItem[];
  cells?: MatrixCell[];
  lines?: string[];
  activeSiteId?: string | null;
  activeSiteName?: string | null;
  error?: string;
};

const CATEGORY_TABS: Array<{ value: CategoryTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "license", label: "Licenses" },
  { value: "medical", label: "Medical" },
  { value: "contract", label: "Contract" },
];
const EXPIRING_DAYS_OPTIONS = [7, 14, 30, 60, 90];
const LINE_FILTER_ALL = "__all__";

function statusBadgeClass(status: MatrixCellStatus): string {
  if (status === "missing" || status === "overdue") return "bg-red-600 text-white border-0";
  if (status === "expiring") return "bg-amber-500 text-white border-0";
  if (status === "valid") return "bg-emerald-600 text-white border-0";
  return "bg-muted text-muted-foreground";
}
function statusLabel(status: MatrixCellStatus): string {
  const map: Record<MatrixCellStatus, string> = {
    missing: "Missing",
    overdue: "Overdue",
    expiring: "Expiring",
    valid: "Valid",
    waived: "Waived",
  };
  return map[status] ?? status;
}

function CellBadge({
  cell,
  catalogCode,
  catalogName,
  onClick,
}: {
  cell: MatrixCell | undefined;
  catalogCode: string;
  catalogName: string;
  onClick: () => void;
}) {
  const status = cell?.status ?? "missing";
  const label = cell ? statusLabel(status) : "Missing";
  const tooltipParts: string[] = [
    `${catalogCode} – ${catalogName}`,
    `Status: ${label}`,
  ];
  if (cell?.valid_to) tooltipParts.push(`Valid to: ${new Date(cell.valid_to).toLocaleDateString()}`);
  if (cell?.days_left != null) tooltipParts.push(`Days left: ${cell.days_left}`);
  if (cell?.notes?.trim()) tooltipParts.push(`Notes: ${cell.notes.trim()}`);
  if (cell?.evidence_url?.trim()) tooltipParts.push(`Evidence: ${cell.evidence_url.trim()}`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} className="focus:outline-none focus:ring-2 focus:ring-ring rounded">
          <Badge className={cn("cursor-pointer shrink-0", statusBadgeClass(status))}>{label}</Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap text-left">
        {tooltipParts.join("\n")}
      </TooltipContent>
    </Tooltip>
  );
}

export default function ComplianceMatrixPage() {
  const { isAdminOrHr } = useOrg();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [category, setCategory] = useState<CategoryTab>("all");
  const [lineFilter, setLineFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [actionOnly, setActionOnly] = useState(true);
  const [expiringDays, setExpiringDays] = useState(30);
  const [drawerEmployee, setDrawerEmployee] = useState<{ id: string; name: string; number: string } | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (lineFilter) params.set("line", lineFilter);
    if (searchDebounced.trim()) params.set("q", searchDebounced.trim());
    params.set("expiringDays", String(expiringDays));
    if (actionOnly) params.set("actionOnly", "1");
    return params;
  }, [category, lineFilter, searchDebounced, expiringDays, actionOnly]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const res = await fetch(`/api/compliance/matrix?${params}`, { credentials: "include", headers: withDevBearer() });
      const json = (await res.json()) as MatrixResponse;
      if (!res.ok || !json.ok) {
        const err = json as { error?: string; step?: string };
        setError(err.error ?? (err.step ? `${err.step}: failed` : "Failed to load matrix"));
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
    loadMatrix();
  }, [loadMatrix]);
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const employees = data?.employees ?? [];
  const catalog = data?.catalog ?? [];
  const cells = data?.cells ?? [];
  const cellMap = useMemo(() => {
    const m = new Map<string, MatrixCell>();
    for (const c of cells) m.set(`${c.employee_id}:${c.compliance_id}`, c);
    return m;
  }, [cells]);
  const lines = useMemo(() => {
    const fromApi = data?.lines ?? [];
    if (fromApi.length > 0) return fromApi;
    return [...new Set(employees.map((e) => e.line).filter(Boolean))].sort() as string[];
  }, [data?.lines, employees]);

  const handleCellClick = useCallback((employeeId: string, name: string, number: string) => {
    setDrawerEmployee({ id: employeeId, name, number });
  }, []);
  const handleDrawerClose = useCallback(() => setDrawerEmployee(null), []);

  const hasCatalog = catalog.length > 0;

  return (
    <OrgGuard>
      <TooltipProvider>
        <div className="max-w-full mx-auto px-4 py-6 space-y-6">
          {!isAdminOrHr && <p className="text-sm text-muted-foreground">Read-only.</p>}
          <header className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Compliance Matrix</h1>
            <p className="text-sm text-muted-foreground">Per-employee compliance status. Click a cell to open details.</p>
          </header>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search employee name or #" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <div role="tablist" className="inline-flex rounded-md border bg-muted/30 p-0.5">
                  {CATEGORY_TABS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={category === value}
                      onClick={() => setCategory(value)}
                      className={cn("rounded px-3 py-1.5 text-sm font-medium transition-colors", category === value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {lines.length > 0 && (
                  <Select
                    value={lineFilter || LINE_FILTER_ALL}
                    onValueChange={(v) => setLineFilter(v === LINE_FILTER_ALL ? "" : v)}
                  >
                    <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="All lines" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LINE_FILTER_ALL}>All lines</SelectItem>
                      {lines.map((line) => <SelectItem key={line} value={line}>{line}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Select value={String(expiringDays)} onValueChange={(v) => setExpiringDays(parseInt(v, 10))}>
                  <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRING_DAYS_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d}d window</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant={actionOnly ? "secondary" : "ghost"} size="sm" className="h-9" onClick={() => setActionOnly(!actionOnly)}>Action only</Button>
                <Badge variant="secondary" className="font-normal text-muted-foreground shrink-0">
                  Site: {data?.activeSiteId ? (data?.activeSiteName ?? "Unknown site") : "All"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mx-4 mb-4">{error}</div>}
              {!loading && !error && !hasCatalog && (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground mx-4">No compliance catalog. Add items from the main Compliance page.</div>
              )}
              {hasCatalog && (
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <table className="w-full text-sm border-collapse" data-testid="compliance-matrix-table">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-2 font-medium sticky left-0 bg-muted/30 z-10 min-w-[160px]">Employee</th>
                          <th className="text-left p-2 font-medium w-20">Line</th>
                          {catalog.map((c) => (
                            <th key={c.id} className="text-center p-2 font-medium min-w-[100px] whitespace-nowrap">
                              <div>{c.code}</div>
                              <div className="text-xs font-normal text-muted-foreground truncate max-w-[120px] mx-auto">{c.name}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employees.length === 0 ? (
                          <tr><td colSpan={catalog.length + 2} className="p-6 text-center text-muted-foreground">No employees match the filters.</td></tr>
                        ) : (
                          employees.map((emp) => (
                            <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/20" data-testid={`matrix-row-${emp.id}`}>
                              <td className="p-2 sticky left-0 bg-background z-10">
                                <span className="font-medium">{emp.name}</span>
                                {emp.employee_number && <span className="block text-xs text-muted-foreground">#{emp.employee_number}</span>}
                              </td>
                              <td className="p-2 text-muted-foreground">{emp.line ?? "—"}</td>
                              {catalog.map((c) => {
                                const cell = cellMap.get(`${emp.id}:${c.id}`);
                                return (
                                  <td key={c.id} className="p-2 text-center" data-testid={`matrix-cell-${emp.id}-${c.id}`}>
                                    <CellBadge cell={cell} catalogCode={c.code} catalogName={c.name} onClick={() => handleCellClick(emp.id, emp.name, emp.employee_number)} />
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <ComplianceDrawer
            open={!!drawerEmployee}
            onOpenChange={(open) => !open && handleDrawerClose()}
            employeeId={drawerEmployee?.id ?? null}
            employeeName={drawerEmployee?.name ?? ""}
            employeeNumber={drawerEmployee?.number ?? ""}
            isAdminOrHr={!!isAdminOrHr}
            onSaved={() => { toast({ title: "Saved" }); loadMatrix(); }}
            posterContext={null}
            activeSiteId={data?.activeSiteId ?? null}
            activeSiteName={data?.activeSiteName ?? null}
          />
        </div>
      </TooltipProvider>
    </OrgGuard>
  );
}
