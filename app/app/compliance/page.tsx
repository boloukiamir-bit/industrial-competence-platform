"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { OrgGuard } from "@/components/OrgGuard";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { BarChart3, ChevronDown, ChevronRight, Clipboard, Grid3X3, Inbox, Loader2, Pencil, Plus, Users } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { ComplianceDrawer } from "@/components/compliance/ComplianceDrawer";
import {
  ComplianceKpiCards,
  type KpiBucket,
  type KpiCardState,
} from "@/components/compliance/ComplianceKpiCards";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ComplianceFilters,
  type CategoryTab,
} from "@/components/compliance/ComplianceFilters";
import {
  ComplianceTable,
  type ComplianceTableRow,
  type RowStatus,
} from "@/components/compliance/ComplianceTable";

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

type KpiCategory = { valid: number; expiring: number; expired: number; missing: number; waived: number };
type OverviewResponse = {
  ok: boolean;
  kpis?: Record<string, KpiCategory>;
  rows?: OverviewRow[];
  catalog?: Array<{ id: string; category: string; code: string; name: string }>;
  activeSiteId?: string | null;
  activeSiteName?: string | null;
};

type CatalogItem = {
  id: string;
  category: string;
  code: string;
  name: string;
  description: string | null;
  default_validity_days: number | null;
  is_active: boolean;
};
type CatalogResponse = { ok: boolean; catalog?: CatalogItem[] };
const CATEGORY_ORDER = ["license", "medical", "contract"] as const;
const CATEGORY_LABELS: Record<string, string> = { license: "Licenser", medical: "Medicinskt", contract: "Avtal" };

type Pack = { id: string; label: string; description: string; codes: string[] };
const COMPLIANCE_PACKS: Pack[] = [
  { id: "safety-basics", label: "Bas – Säkerhet & etik (alla)", description: "Brand, Första hjälpen, HLR, Business Ethics", codes: ["TRN_FIRE_SAFETY", "TRN_FIRST_AID", "TRN_CPR_HLR", "POL_BUSINESS_ETHICS"] },
  { id: "night-medical", label: "Natt – Medicinska kontroller (målgrupp)", description: "Nattundersökning + standardkontroller", codes: ["MED_NIGHT_EXAM", "MED_HEALTH_CHECK", "MED_HEARING", "MED_VISION"] },
  { id: "hardplast", label: "Härdplast – Exponering (målgrupp)", description: "Utbildning + undersökning", codes: ["TRN_EPOXY_TRAINING", "MED_EPOXY_ISOCYANATE"] },
];

function computeKpiStats(rows: OverviewRow[]): Record<KpiBucket, KpiCardState> & { totalEmployees: number } {
  const empIds = new Set(rows.map((r) => r.employee_id));
  const totalEmployees = empIds.size;
  const actionEmp = new Set<string>();
  const expiringEmp = new Set<string>();
  const validEmp = new Set<string>();
  const waivedEmp = new Set<string>();
  let actionCount = 0,
    expiringCount = 0,
    validCount = 0,
    waivedCount = 0;

  for (const r of rows) {
    if (r.status === "missing" || r.status === "expired") {
      actionCount++;
      actionEmp.add(r.employee_id);
    } else if (r.status === "expiring") {
      expiringCount++;
      expiringEmp.add(r.employee_id);
    } else if (r.status === "valid") {
      validCount++;
      validEmp.add(r.employee_id);
    } else if (r.status === "waived") {
      waivedCount++;
      waivedEmp.add(r.employee_id);
    }
  }

  const pct = (n: number) => (totalEmployees > 0 ? (n / totalEmployees) * 100 : 0);
  return {
    totalEmployees,
    action_required: { count: actionCount, employeeCount: actionEmp.size, employeePct: pct(actionEmp.size), totalEmployees },
    expiring_soon: { count: expiringCount, employeeCount: expiringEmp.size, employeePct: pct(expiringEmp.size), totalEmployees },
    valid: { count: validCount, employeeCount: validEmp.size, employeePct: pct(validEmp.size), totalEmployees },
    waived: { count: waivedCount, employeeCount: waivedEmp.size, employeePct: pct(waivedEmp.size), totalEmployees },
  };
}

function aggregateRows(
  rows: OverviewRow[],
  category: CategoryTab
): ComplianceTableRow[] {
  const filtered =
    category === "all" ? rows : rows.filter((r) => r.category === category);
  const byEmp = new Map<
    string,
    { row: OverviewRow; missing: number; expiring: number; overdue: number; valid: number; waived: number }
  >();
  for (const r of filtered) {
    const cur = byEmp.get(r.employee_id);
    const missing = r.status === "missing" ? 1 : 0;
    const expiring = r.status === "expiring" ? 1 : 0;
    const overdue = r.status === "expired" ? 1 : 0;
    const valid = r.status === "valid" ? 1 : 0;
    const waived = r.status === "waived" ? 1 : 0;
    if (!cur) {
      byEmp.set(r.employee_id, {
        row: r,
        missing,
        expiring,
        overdue,
        valid,
        waived,
      });
    } else {
      cur.missing += missing;
      cur.expiring += expiring;
      cur.overdue += overdue;
      cur.valid += valid;
      cur.waived += waived;
    }
  }
  const result: ComplianceTableRow[] = [];
  for (const [, v] of byEmp) {
    const rowStatus: RowStatus =
      v.missing > 0 || v.overdue > 0
        ? "action_required"
        : v.expiring > 0
          ? "expiring"
          : "ok";
    result.push({
      employee_id: v.row.employee_id,
      employee_name: v.row.employee_name,
      employee_number: v.row.employee_number ?? "",
      line: v.row.line,
      department: v.row.department,
      missing: v.missing,
      expiring: v.expiring,
      overdue: v.overdue,
      waived: v.waived,
      rowStatus,
    });
  }
  return result.sort((a, b) => {
    const score = (r: ComplianceTableRow) =>
      (r.missing + r.overdue) * 100 + r.expiring;
    return score(b) - score(a);
  });
}

export default function CompliancePage() {
  const { isAdminOrHr, currentOrg } = useOrg();
  const canWrite = isAdminOrHr;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [lineFilter, setLineFilter] = useState("");
  const [actionRequiredOnly, setActionRequiredOnly] = useState(true);
  const [activeBucket, setActiveBucket] = useState<KpiBucket | null>("action_required");
  const [drawerEmployee, setDrawerEmployee] = useState<{
    id: string;
    name: string;
    number: string;
  } | null>(null);
  const [avanceratOpen, setAvanceratOpen] = useState(false);
  const [catalogList, setCatalogList] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogForm, setCatalogForm] = useState({
    code: "",
    name: "",
    category: "license",
    description: "",
    default_validity_days: "",
    is_active: true,
  });
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkAssignForm, setBulkAssignForm] = useState({
    complianceCode: "",
    scope: "all" as "all" | "line" | "department" | "shift" | "area",
    scopeValue: "",
    validFrom: "",
    validTo: "",
    notes: "",
    waived: false,
  });
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [packForm, setPackForm] = useState({
    scope: "all" as "all" | "line" | "department" | "area",
    scopeValue: "",
    validFrom: "",
    validTo: "",
    notes: "",
    waived: false,
  });
  const [packSubmitting, setPackSubmitting] = useState(false);

  const loadOverview = useCallback(async () => {
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
        const err = (json as { error?: string }).error ?? "Failed to load";
        setError(err);
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
  }, [searchDebounced]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/compliance/catalog", { credentials: "include", headers: withDevBearer() });
      const json = (await res.json()) as CatalogResponse;
      if (!res.ok || !json.ok) {
        setCatalogError((json as { error?: string }).error ?? "Kunde inte ladda katalogen");
        setCatalogList([]);
        return;
      }
      setCatalogList(json.catalog ?? []);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Kunde inte ladda katalogen");
      setCatalogList([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (data == null) return;
    console.log("[Compliance site chip diagnostic]", {
      active_org_id: currentOrg?.id ?? null,
      active_site_id: data.activeSiteId ?? null,
      resolved_site_name: data.activeSiteName ?? null,
      source: "API response from GET /api/compliance/overview",
    });
  }, [data, currentOrg?.id]);

  const rows = data?.rows ?? [];
  const kpiStats = useMemo(() => computeKpiStats(rows), [rows]);
  const aggregated = useMemo(
    () => aggregateRows(rows, category),
    [rows, category]
  );
  const lines = useMemo(
    () => [...new Set(aggregated.map((r) => r.line).filter(Boolean))].sort() as string[],
    [aggregated]
  );
  const filteredTableRows = useMemo(() => {
    let list = aggregated;
    if (lineFilter) list = list.filter((r) => r.line === lineFilter);
    if (actionRequiredOnly) {
      list = list.filter((r) => r.rowStatus === "action_required");
    } else if (activeBucket === "action_required") {
      list = list.filter((r) => r.rowStatus === "action_required");
    } else if (activeBucket === "expiring_soon") {
      list = list.filter((r) => r.rowStatus === "expiring");
    } else if (activeBucket === "valid") {
      list = list.filter((r) => r.rowStatus === "ok");
    } else if (activeBucket === "waived") {
      list = list.filter((r) => r.waived > 0);
    }
    return list;
  }, [aggregated, lineFilter, actionRequiredOnly, activeBucket]);

  const handleBucketClick = useCallback((bucket: KpiBucket) => {
    setActiveBucket((prev) => (prev === bucket ? null : bucket));
    setActionRequiredOnly(bucket === "action_required");
  }, []);

  const clearKpiFilter = useCallback(() => {
    setActiveBucket(null);
    setActionRequiredOnly(false);
  }, []);

  const handleReview = useCallback((employeeId: string, name: string, number: string) => {
    setDrawerEmployee({ id: employeeId, name, number });
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerEmployee(null);
  }, []);

  const hasCatalog = (data?.catalog?.length ?? 0) > 0;

  return (
    <OrgGuard>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {!canWrite && (
          <p className="text-sm text-muted-foreground">Read-only.</p>
        )}

        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Licenses, medical checks, contracts — validity and triage
          </p>
        </header>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/onboarding">Get started</Link>
          </Button>
          <div className="flex gap-2">
          {canWrite && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/compliance/summary">
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Compliance Summary
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/compliance/actions">
                  <Inbox className="h-4 w-4 mr-1.5" />
                  Action Inbox
                </Link>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/compliance/digest">
              <Clipboard className="h-4 w-4 mr-1.5" />
              Weekly Digest
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/compliance/matrix">
              <Grid3X3 className="h-4 w-4 mr-1.5" />
              Compliance Matrix
            </Link>
          </Button>
          </div>
        </div>

        {/* Triage KPI bar */}
        <ComplianceKpiCards
          stats={kpiStats}
          activeBucket={activeBucket}
          onBucketClick={handleBucketClick}
          loading={loading}
        />

        {/* Site context + Filters */}
        <div className="space-y-2">
          <Badge variant="secondary" className="font-normal text-muted-foreground">
            Site: {data?.activeSiteId ? (data?.activeSiteName ?? "Unknown site") : "All"}
          </Badge>
          <ComplianceFilters
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            lineFilter={lineFilter}
            onLineFilterChange={setLineFilter}
            lines={lines}
            actionRequiredOnly={actionRequiredOnly}
            onActionRequiredOnlyChange={setActionRequiredOnly}
            kpiFilterActive={activeBucket != null}
            onClearKpiFilter={clearKpiFilter}
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Empty catalog */}
        {!loading && !error && !hasCatalog && (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
            No compliance catalog. Add items in Admin.
          </div>
        )}

        {/* Table */}
        {hasCatalog && (
          <ComplianceTable
            rows={filteredTableRows}
            onReview={handleReview}
            loading={loading}
          />
        )}

        {/* Compliance catalog — visible to all; Add/Edit only for admin/hr */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Compliancekatalog</h2>
            {canWrite && (
              <Button size="sm" onClick={() => { setEditingCatalogItem(null); setCatalogForm({ code: "", name: "", category: "license", description: "", default_validity_days: "", is_active: true }); setCatalogDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Lägg till
              </Button>
            )}
          </div>
          {catalogLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Laddar katalog…
            </div>
          ) : catalogError ? (
            <p className="text-sm text-destructive py-2">{catalogError}</p>
          ) : catalogList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Inga katalogposter. {canWrite ? "Lägg till ovan." : ""}</p>
          ) : (
            <div className="space-y-4">
              {CATEGORY_ORDER.map((cat) => {
                const items = catalogList.filter((i) => i.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {CATEGORY_LABELS[cat] ?? cat} ({items.length})
                    </h3>
                    <ul className="rounded-lg border border-border divide-y divide-border">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className={`flex items-center justify-between gap-3 px-3 py-2 ${!item.is_active ? "bg-muted/40 text-muted-foreground" : ""}`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm">{item.name}</span>
                            <span className="block text-xs text-muted-foreground">{item.code}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs">
                            {item.default_validity_days != null ? (
                              <span className="text-muted-foreground">{item.default_validity_days} dagar</span>
                            ) : null}
                            <Badge variant={item.is_active ? "default" : "secondary"} className={item.is_active ? "bg-emerald-600/20 text-emerald-700" : ""}>
                              {item.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setEditingCatalogItem(item);
                                  setCatalogForm({
                                    code: item.code,
                                    name: item.name,
                                    category: item.category,
                                    description: item.description ?? "",
                                    default_validity_days: item.default_validity_days != null ? String(item.default_validity_days) : "",
                                    is_active: item.is_active,
                                  });
                                  setCatalogDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Redigera
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Admin: Avancerat */}
        {canWrite && (
          <Collapsible open={avanceratOpen} onOpenChange={setAvanceratOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {avanceratOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Admin: packs, catalog, bulk assign
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {COMPLIANCE_PACKS.map((pack) => (
                  <Button
                    key={pack.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPack(pack);
                      setPackForm({ scope: "all", scopeValue: "", validFrom: "", validTo: "", notes: "", waived: false });
                      setPackDialogOpen(true);
                    }}
                  >
                    {pack.label}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => setBulkAssignDialogOpen(true)}>
                  <Users className="h-4 w-4 mr-1.5" />
                  Bulk assign
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Review drawer */}
        <ComplianceDrawer
          open={!!drawerEmployee}
          onOpenChange={(open) => !open && handleDrawerClose()}
          employeeId={drawerEmployee?.id ?? null}
          employeeName={drawerEmployee?.name ?? ""}
          employeeNumber={drawerEmployee?.number ?? ""}
          isAdminOrHr={!!canWrite}
          onSaved={() => {
            toast({ title: "Saved" });
            loadOverview();
          }}
          posterContext={null}
          activeSiteId={data?.activeSiteId ?? null}
          activeSiteName={data?.activeSiteName ?? null}
        />

        {/* Bulk assign dialog */}
        <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk assign compliance</DialogTitle>
              <DialogDescription>Assign one compliance type to many employees by scope.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Compliance</Label>
                <Select
                  value={bulkAssignForm.complianceCode}
                  onValueChange={(v) => setBulkAssignForm((f) => ({ ...f, complianceCode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select compliance" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalog ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Scope</Label>
                <Select
                  value={bulkAssignForm.scope}
                  onValueChange={(v) => setBulkAssignForm((f) => ({ ...f, scope: v as typeof bulkAssignForm.scope }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active employees</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="shift" disabled>Shift — N/A</SelectItem>
                    <SelectItem value="area">Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {bulkAssignForm.scope !== "all" && (
                <div className="grid gap-2">
                  <Label>{bulkAssignForm.scope === "line" ? "Line" : bulkAssignForm.scope === "department" ? "Department" : "Area"}</Label>
                  <Input
                    value={bulkAssignForm.scopeValue}
                    onChange={(e) => setBulkAssignForm((f) => ({ ...f, scopeValue: e.target.value }))}
                    placeholder="e.g. Line A"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valid from (optional)</Label>
                  <Input
                    type="date"
                    value={bulkAssignForm.validFrom}
                    onChange={(e) => setBulkAssignForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Valid to (optional)</Label>
                  <Input
                    type="date"
                    value={bulkAssignForm.validTo}
                    onChange={(e) => setBulkAssignForm((f) => ({ ...f, validTo: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={bulkAssignForm.notes}
                  onChange={(e) => setBulkAssignForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bulk-waived"
                  checked={bulkAssignForm.waived}
                  onChange={(e) => setBulkAssignForm((f) => ({ ...f, waived: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="bulk-waived">Waived</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={
                  !bulkAssignForm.complianceCode ||
                  (bulkAssignForm.scope !== "all" && !bulkAssignForm.scopeValue.trim()) ||
                  bulkAssignSaving
                }
                onClick={async () => {
                  setBulkAssignSaving(true);
                  try {
                    const res = await fetch("/api/compliance/bulk-assign", {
                      method: "POST",
                      credentials: "include",
                      headers: withDevBearer({ "Content-Type": "application/json" }),
                      body: JSON.stringify({
                        compliance_code: bulkAssignForm.complianceCode,
                        scope: bulkAssignForm.scope,
                        scope_value: bulkAssignForm.scope === "all" ? null : bulkAssignForm.scopeValue.trim() || null,
                        valid_from: bulkAssignForm.validFrom.trim() || null,
                        valid_to: bulkAssignForm.validTo.trim() || null,
                        notes: bulkAssignForm.notes.trim() || null,
                        waived: bulkAssignForm.waived,
                      }),
                    });
                    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; inserted?: number; updated?: number };
                    if (!res.ok || !json.ok) {
                      toast({ title: json.error ?? "Failed", variant: "destructive" });
                      return;
                    }
                    toast({ title: `Done: ${json.inserted ?? 0} inserted, ${json.updated ?? 0} updated` });
                    setBulkAssignDialogOpen(false);
                    setBulkAssignForm({ complianceCode: "", scope: "all", scopeValue: "", validFrom: "", validTo: "", notes: "", waived: false });
                    loadOverview();
                  } finally {
                    setBulkAssignSaving(false);
                  }
                }}
              >
                {bulkAssignSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pack dialog */}
        <Dialog open={packDialogOpen} onOpenChange={(o) => (!o && setSelectedPack(null), setPackDialogOpen(o))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedPack?.label ?? "Pack"}</DialogTitle>
              <DialogDescription>Assign all items in the pack to employees.</DialogDescription>
            </DialogHeader>
            {selectedPack && (
              <>
                <div className="grid gap-2">
                  <Label>Included items</Label>
                  <ul className="text-sm rounded-lg border bg-muted/20 divide-y divide-border/50">
                    {selectedPack.codes.map((code) => {
                      const catalogItem = data?.catalog?.find((c) => c.code === code);
                      return (
                        <li key={code} className="flex items-center justify-between gap-2 px-3 py-2">
                          {catalogItem ? (
                            <div>
                              <span className="font-medium">{catalogItem.name}</span>
                              <span className="block text-xs text-muted-foreground">{catalogItem.code}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-muted-foreground">{code}</span>
                              <span className="block text-xs text-muted-foreground">Not in catalog</span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="grid gap-2">
                  <Label>Scope</Label>
                  <Select value={packForm.scope} onValueChange={(v) => setPackForm((f) => ({ ...f, scope: v as typeof packForm.scope }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All active employees</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {packForm.scope !== "all" && (
                  <div className="grid gap-2">
                    <Label>{packForm.scope === "line" ? "Line" : packForm.scope === "department" ? "Department" : "Area"}</Label>
                    <Input value={packForm.scopeValue} onChange={(e) => setPackForm((f) => ({ ...f, scopeValue: e.target.value }))} placeholder="e.g. Line A" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Valid from (optional)</Label>
                    <Input type="date" value={packForm.validFrom} onChange={(e) => setPackForm((f) => ({ ...f, validFrom: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Valid to (optional)</Label>
                    <Input type="date" value={packForm.validTo} onChange={(e) => setPackForm((f) => ({ ...f, validTo: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes (optional)</Label>
                  <Input value={packForm.notes} onChange={(e) => setPackForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="pack-waived" checked={packForm.waived} onChange={(e) => setPackForm((f) => ({ ...f, waived: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <Label htmlFor="pack-waived">Waived</Label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPackDialogOpen(false)}>Cancel</Button>
                  <Button
                    disabled={(packForm.scope !== "all" && !packForm.scopeValue.trim()) || packSubmitting}
                    onClick={async () => {
                      if (!selectedPack) return;
                      setPackSubmitting(true);
                      let ti = 0,
                        tu = 0;
                      try {
                        for (const code of selectedPack.codes) {
                          const res = await fetch("/api/compliance/bulk-assign", {
                            method: "POST",
                            credentials: "include",
                            headers: withDevBearer({ "Content-Type": "application/json" }),
                            body: JSON.stringify({
                              compliance_code: code,
                              scope: packForm.scope,
                              scope_value: packForm.scope === "all" ? null : packForm.scopeValue.trim() || null,
                              valid_from: packForm.validFrom.trim() || null,
                              valid_to: packForm.validTo.trim() || null,
                              notes: packForm.notes.trim() || null,
                              waived: packForm.waived,
                            }),
                          });
                          const json = (await res.json().catch(() => ({}))) as { inserted?: number; updated?: number };
                          ti += json.inserted ?? 0;
                          tu += json.updated ?? 0;
                        }
                        setPackDialogOpen(false);
                        setSelectedPack(null);
                        toast({ title: `Pack assigned: ${ti} inserted, ${tu} updated` });
                        loadOverview();
                      } finally {
                        setPackSubmitting(false);
                      }
                    }}
                  >
                    {packSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Assign pack
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Catalog dialog — Add/Edit (admin/hr only) */}
        <Dialog
          open={catalogDialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditingCatalogItem(null);
            setCatalogDialogOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCatalogItem ? "Redigera katalogpost" : "Lägg till katalogpost"}</DialogTitle>
              <DialogDescription>
                {editingCatalogItem ? "Uppdatera fält. Koden kan inte ändras." : "Kod måste vara unik. Rekommenderat: STORA_BOKSTÄVER_UNDERSTRECK."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Kod</Label>
                <Input
                  value={catalogForm.code}
                  onChange={(e) => setCatalogForm((f) => ({ ...f, code: e.target.value.trim().toUpperCase().replace(/\s+/g, "_") }))}
                  placeholder="t.ex. FORKLIFT_A"
                  disabled={!!editingCatalogItem}
                />
              </div>
              <div className="grid gap-2">
                <Label>Namn</Label>
                <Input value={catalogForm.name} onChange={(e) => setCatalogForm((f) => ({ ...f, name: e.target.value }))} placeholder="t.ex. Truckkort A" />
              </div>
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Select value={catalogForm.category} onValueChange={(v) => setCatalogForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="license">Licens</SelectItem>
                    <SelectItem value="medical">Medicinskt</SelectItem>
                    <SelectItem value="contract">Avtal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Beskrivning (valfritt)</Label>
                <Input value={catalogForm.description} onChange={(e) => setCatalogForm((f) => ({ ...f, description: e.target.value }))} placeholder="Kort beskrivning" />
              </div>
              <div className="grid gap-2">
                <Label>Standard giltighet (dagar, valfritt)</Label>
                <Input
                  type="number"
                  min={0}
                  value={catalogForm.default_validity_days}
                  onChange={(e) => setCatalogForm((f) => ({ ...f, default_validity_days: e.target.value }))}
                  placeholder="365"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={catalogForm.is_active}
                  onCheckedChange={(c: boolean) => setCatalogForm((f) => ({ ...f, is_active: c }))}
                />
                <Label className="text-sm">Aktiv</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>Avbryt</Button>
              <Button
                disabled={
                  !catalogForm.code.trim() ||
                  !catalogForm.name.trim() ||
                  catalogSaving ||
                  (() => {
                    const days = catalogForm.default_validity_days.trim();
                    if (!days) return false;
                    const n = parseInt(days, 10);
                    return isNaN(n) || n < 0;
                  })()
                }
                onClick={async () => {
                  const code = catalogForm.code.trim();
                  const name = catalogForm.name.trim();
                  const daysStr = catalogForm.default_validity_days.trim();
                  let default_validity_days: number | null = null;
                  if (daysStr) {
                    const n = parseInt(daysStr, 10);
                    if (isNaN(n) || n < 0) {
                      toast({ title: "Giltighet måste vara ≥ 0", variant: "destructive" });
                      return;
                    }
                    default_validity_days = n;
                  }
                  setCatalogSaving(true);
                  try {
                    const res = await fetch("/api/compliance/catalog/upsert", {
                      method: "POST",
                      credentials: "include",
                      headers: withDevBearer({ "Content-Type": "application/json" }),
                      body: JSON.stringify({
                        code,
                        name,
                        category: catalogForm.category,
                        description: catalogForm.description?.trim() || null,
                        default_validity_days,
                        is_active: catalogForm.is_active,
                      }),
                    });
                    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; step?: string };
                    if (!res.ok) {
                      toast({ title: json.error ?? (json.step ? `Sparande misslyckades (${json.step})` : "Kunde inte spara"), variant: "destructive" });
                      return;
                    }
                    toast({ title: "Katalogpost sparad" });
                    setCatalogDialogOpen(false);
                    setEditingCatalogItem(null);
                    setCatalogForm({ code: "", name: "", category: "license", description: "", default_validity_days: "", is_active: true });
                    loadCatalog();
                    loadOverview();
                  } finally {
                    setCatalogSaving(false);
                  }
                }}
              >
                {catalogSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Spara
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OrgGuard>
  );
}
