"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { OrgGuard } from "@/components/OrgGuard";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Search, Loader2, Shield, Plus, Users, Package, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { withDevBearer } from "@/lib/devBearer";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { ComplianceDrawer } from "@/components/compliance/ComplianceDrawer";

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

type Pack = { id: string; label: string; description: string; codes: string[] };
const COMPLIANCE_PACKS: Pack[] = [
  { id: "safety-basics", label: "Bas – Säkerhet & etik (alla)", description: "Brand, Första hjälpen, HLR, Business Ethics", codes: ["TRN_FIRE_SAFETY", "TRN_FIRST_AID", "TRN_CPR_HLR", "POL_BUSINESS_ETHICS"] },
  { id: "night-medical", label: "Natt – Medicinska kontroller (målgrupp)", description: "Nattundersökning + standardkontroller", codes: ["MED_NIGHT_EXAM", "MED_HEALTH_CHECK", "MED_HEARING", "MED_VISION"] },
  { id: "hardplast", label: "Härdplast – Exponering (målgrupp)", description: "Utbildning + undersökning", codes: ["TRN_EPOXY_TRAINING", "MED_EPOXY_ISOCYANATE"] },
];

type KpiCategory = { valid: number; expiring: number; expired: number; missing: number; waived: number };
type OverviewResponse = {
  ok: boolean;
  kpis?: Record<string, KpiCategory>;
  rows?: OverviewRow[];
  catalog?: Array<{ id: string; category: string; code: string; name: string }>;
};

function sumKpis(kpis: Record<string, KpiCategory> | undefined): KpiCategory {
  const out = { valid: 0, expiring: 0, expired: 0, missing: 0, waived: 0 };
  if (!kpis) return out;
  for (const cat of Object.values(kpis)) {
    out.valid += cat.valid;
    out.expiring += cat.expiring;
    out.expired += cat.expired;
    out.missing += cat.missing;
    out.waived += cat.waived;
  }
  return out;
}

const STATUS_LABELS: Record<string, string> = {
  missing: "Saknas",
  expired: "Utgånget",
  expiring: "På väg att gå ut",
  valid: "Giltigt",
  waived: "Undantaget",
};

type AggregatedEmployee = {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  line: string | null;
  department: string | null;
  missing: number;
  expired: number;
  expiring: number;
  valid: number;
  waived: number;
  riskScore: number;
  nextAction: string;
};

type AggregatedPost = {
  code: string;
  name: string;
  missing: number;
  expired: number;
  expiring: number;
  employees: Array<{ id: string; name: string; employee_number: string }>;
};

export default function CompliancePage() {
  const searchParams = useSearchParams();
  const { isAdminOrHr } = useOrg();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [viewMode, setViewMode] = useState<"medarbetare" | "poster">("medarbetare");
  const [category, setCategory] = useState<string>(() => searchParams.get("category") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sheetState, setSheetState] = useState<
    | { type: "employee"; id: string; name: string; number: string }
    | { type: "poster"; code: string; name: string; employees: Array<{ id: string; name: string; employee_number: string }> }
    | null
  >(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ code: "", name: "", category: "license" as string, description: "", default_validity_days: "" });
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
  const [avanceratOpen, setAvanceratOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await fetch(`/api/compliance/overview?${params}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as OverviewResponse;
      if (!res.ok || !json.ok) {
        const err = (json as { error?: string }).error ?? "Kunde inte ladda";
        setError(err);
        toast({ title: err, variant: "destructive" });
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kunde inte ladda";
      setError(msg);
      toast({ title: msg, variant: "destructive" });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [category, statusFilter, searchDebounced, toast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const rows = data?.rows ?? [];
  const kpiTotals: KpiCategory =
    category === "all"
      ? sumKpis(data?.kpis)
      : (data?.kpis?.[category] ?? { valid: 0, expiring: 0, expired: 0, missing: 0, waived: 0 });

  const aggregatedEmployees = useMemo((): AggregatedEmployee[] => {
    const byEmp = new Map<string, { row: OverviewRow; status: string }[]>();
    for (const row of rows) {
      const list = byEmp.get(row.employee_id) ?? [];
      list.push({ row, status: row.status });
      byEmp.set(row.employee_id, list);
    }
    const result: AggregatedEmployee[] = [];
    for (const [empId, list] of byEmp) {
      const first = list[0].row;
      const counts = { missing: 0, expired: 0, expiring: 0, valid: 0, waived: 0 };
      for (const { status } of list) {
        if (status in counts) (counts as Record<string, number>)[status]++;
      }
      const riskScore =
        counts.expired * 1000 +
        counts.missing * 100 +
        counts.expiring * 10 +
        counts.valid +
        counts.waived * 0.01;
      let nextAction = "";
      if (counts.expired > 0) nextAction = `${counts.expired} utgångna`;
      else if (counts.missing > 0) nextAction = `${counts.missing} saknas`;
      else if (counts.expiring > 0) nextAction = `${counts.expiring} på väg att gå ut`;
      result.push({
        employee_id: empId,
        employee_name: first.employee_name,
        employee_number: first.employee_number,
        line: first.line,
        department: first.department,
        ...counts,
        riskScore,
        nextAction,
      });
    }
    return result.sort((a, b) => b.riskScore - a.riskScore);
  }, [rows]);

  const aggregatedPosts = useMemo((): AggregatedPost[] => {
    const byCode = new Map<string, { name: string; missing: number; expired: number; expiring: number; employees: Map<string, { name: string; employee_number: string }> }>();
    for (const row of rows) {
      const status = row.status;
      if (status !== "missing" && status !== "expired" && status !== "expiring") continue;
      const cur = byCode.get(row.compliance_code);
      if (!cur) {
        const empMap = new Map<string, { name: string; employee_number: string }>();
        empMap.set(row.employee_id, { name: row.employee_name, employee_number: row.employee_number ?? "" });
        byCode.set(row.compliance_code, {
          name: row.compliance_name,
          missing: status === "missing" ? 1 : 0,
          expired: status === "expired" ? 1 : 0,
          expiring: status === "expiring" ? 1 : 0,
          employees: empMap,
        });
      } else {
        if (!cur.employees.has(row.employee_id)) {
          cur.employees.set(row.employee_id, { name: row.employee_name, employee_number: row.employee_number ?? "" });
        }
        if (status === "missing") cur.missing++;
        else if (status === "expired") cur.expired++;
        else cur.expiring++;
      }
    }
    return Array.from(byCode.entries()).map(([code, v]) => ({
      code,
      name: v.name,
      missing: v.missing,
      expired: v.expired,
      expiring: v.expiring,
      employees: Array.from(v.employees.entries()).map(([id, e]) => ({
        id,
        name: e.name,
        employee_number: e.employee_number,
      })),
    }));
  }, [rows]);

  const filteredEmployees = useMemo(() => {
    if (statusFilter === "all") return aggregatedEmployees;
    return aggregatedEmployees.filter((e) => {
      if (statusFilter === "missing" && e.missing > 0) return true;
      if (statusFilter === "expired" && e.expired > 0) return true;
      if (statusFilter === "expiring" && e.expiring > 0) return true;
      if (statusFilter === "valid" && e.valid > 0) return true;
      if (statusFilter === "waived" && e.waived > 0) return true;
      return false;
    });
  }, [aggregatedEmployees, statusFilter]);

  const hasZeroAssignments = rows.length === 0;

  const openEmployeeSheet = (id: string, name: string, number: string) => {
    setSheetState({ type: "employee", id, name, number });
    setSheetOpen(true);
  };

  const openPosterSheet = (code: string, name: string, employees: Array<{ id: string; name: string; employee_number: string }>) => {
    setSheetState({ type: "poster", code, name, employees });
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    setSheetState(null);
  };

  const handleSelectEmployeeFromPoster = (id: string, name: string, employeeNumber?: string) => {
    setSheetState({ type: "employee", id, name, number: employeeNumber ?? "" });
  };

  const handleKpiClick = (key: string) => {
    setStatusFilter((prev) => (prev === key ? "all" : key));
  };

  const statusChips = [
    { key: "missing", label: "Saknas", value: kpiTotals.missing },
    { key: "expired", label: "Utgånget", value: kpiTotals.expired },
    { key: "expiring", label: "På väg att gå ut", value: kpiTotals.expiring },
    { key: "valid", label: "Giltigt", value: kpiTotals.valid },
    { key: "waived", label: "Undantaget", value: kpiTotals.waived },
  ];

  return (
    <OrgGuard>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {!isAdminOrHr && (
          <p className="text-sm text-muted-foreground">Endast läsning.</p>
        )}

        <header className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
            <p className="text-muted-foreground mt-1">Licenser, medicinska kontroller, avtal — giltighet och utgång</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdminOrHr && (
              <>
                <div className="flex flex-wrap gap-2">
                  {COMPLIANCE_PACKS.map((pack) => (
                    <Button
                      key={pack.id}
                      variant="outline"
                      size="sm"
                      className="h-auto py-2 px-4"
                      onClick={() => {
                        setSelectedPack(pack);
                        setPackForm({ scope: "all", scopeValue: "", validFrom: "", validTo: "", notes: "", waived: false });
                        setPackDialogOpen(true);
                      }}
                    >
                      {pack.label}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCatalogDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Lägg till katalogpost
                </Button>
              </>
            )}
            <Collapsible open={avanceratOpen} onOpenChange={setAvanceratOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  {avanceratOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Avancerat
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla status</SelectItem>
                      <SelectItem value="missing">Saknas</SelectItem>
                      <SelectItem value="expired">Utgånget</SelectItem>
                      <SelectItem value="expiring">På väg att gå ut</SelectItem>
                      <SelectItem value="valid">Giltigt</SelectItem>
                      <SelectItem value="waived">Undantaget</SelectItem>
                    </SelectContent>
                  </Select>
                  {isAdminOrHr && (
                    <Button variant="outline" size="sm" onClick={() => setBulkAssignDialogOpen(true)}>
                      <Users className="h-4 w-4 mr-1.5" />
                      Mass tilldela
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </header>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {loading ? (
            <div className="h-9 w-48 bg-muted animate-pulse rounded-full" />
          ) : (
            statusChips.map(({ key, label, value }) => {
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKpiClick(key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"
                  }`}
                >
                  {label}
                  <span className="tabular-nums">{value}</span>
                </button>
              );
            })
          )}
        </div>

        {/* View toggle + filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="tablist"
            className="inline-flex rounded-lg border bg-muted/30 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "medarbetare"}
              onClick={() => setViewMode("medarbetare")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "medarbetare" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Medarbetare
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "poster"}
              onClick={() => setViewMode("poster")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "poster" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Poster
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök medarbetare..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {["all", "license", "medical", "contract"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  category === c ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "all" ? "Alla" : c === "license" ? "Licens" : c === "medical" ? "Medicinsk" : "Avtal"}
              </button>
            ))}
          </div>
        </div>

        {hasZeroAssignments && !loading && (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
            Starta här: välj ett paket och tilldela till rätt målgrupp.
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-destructive text-center py-8">{error}</p>
        ) : !data?.catalog?.length ? (
          <p className="text-muted-foreground text-center py-8">Inga katalogposter. Lägg till i katalogen.</p>
        ) : viewMode === "medarbetare" ? (
          <div className="space-y-1">
            {filteredEmployees.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">Inga medarbetare matchar filtren.</p>
            ) : (
              filteredEmployees.map((emp) => (
                <button
                  key={emp.employee_id}
                  type="button"
                  onClick={() => openEmployeeSheet(emp.employee_id, emp.employee_name, emp.employee_number)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{emp.employee_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {[emp.department, emp.line].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        emp.expired > 0
                          ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                          : emp.missing > 0 || emp.expiring > 0
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                      }`}
                    >
                      {emp.expired > 0 ? "Kritisk" : emp.missing > 0 || emp.expiring > 0 ? "Åtgärd krävs" : "OK"}
                    </span>
                    {(emp.expired > 0 || emp.missing > 0 || emp.expiring > 0) && (
                      <span className="text-xs text-muted-foreground">
                        {[
                          emp.expired > 0 && `${STATUS_LABELS.expired} ${emp.expired}`,
                          emp.missing > 0 && `${STATUS_LABELS.missing} ${emp.missing}`,
                          emp.expiring > 0 && `${STATUS_LABELS.expiring} ${emp.expiring}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {aggregatedPosts.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">Inga poster med problem.</p>
            ) : (
              aggregatedPosts.map((post) => (
                  <button
                    key={post.code}
                    type="button"
                    onClick={() => openPosterSheet(post.code, post.name, post.employees)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{post.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{post.code}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {post.expired > 0 && (
                        <span className="text-xs text-destructive font-medium">{post.expired} utgångna</span>
                      )}
                      {post.missing > 0 && (
                        <span className="text-xs text-muted-foreground">{post.missing} saknas</span>
                      )}
                      {post.expiring > 0 && (
                        <span className="text-xs text-amber-600">{post.expiring} på väg att gå ut</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">{post.employees.length} medarbetare</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                  </button>
                ))
            )}
          </div>
        )}

        <ComplianceDrawer
          open={sheetOpen}
          onOpenChange={(open) => !open && handleSheetClose()}
          employeeId={sheetState?.type === "employee" ? sheetState.id : null}
          employeeName={sheetState?.type === "employee" ? sheetState.name : ""}
          employeeNumber={sheetState?.type === "employee" ? sheetState.number : ""}
          isAdminOrHr={isAdminOrHr}
          onSaved={() => {
            toast({ title: "Sparat" });
            loadOverview();
          }}
          posterContext={
            sheetState?.type === "poster"
              ? {
                  code: sheetState.code,
                  name: sheetState.name,
                  employees: sheetState.employees,
                }
              : null
          }
          onSelectEmployee={handleSelectEmployeeFromPoster}
        />

        <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mass tilldela compliance</DialogTitle>
              <DialogDescription>
                Tilldela en compliancetyp till flera medarbetare via omfattning.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Compliance</Label>
                <Select
                  value={bulkAssignForm.complianceCode}
                  onValueChange={(v) => setBulkAssignForm((f) => ({ ...f, complianceCode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj compliance" />
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
                <Label>Omfattning</Label>
                <Select
                  value={bulkAssignForm.scope}
                  onValueChange={(v) =>
                    setBulkAssignForm((f) => ({ ...f, scope: v as typeof bulkAssignForm.scope }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla aktiva medarbetare</SelectItem>
                    <SelectItem value="line">Linje</SelectItem>
                    <SelectItem value="department">Avdelning</SelectItem>
                    <SelectItem value="shift" disabled>Skift — Ej tillgängligt</SelectItem>
                    <SelectItem value="area">Område</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {bulkAssignForm.scope !== "all" && (
                <div className="grid gap-2">
                  <Label>
                    {bulkAssignForm.scope === "line" ? "Linje" : bulkAssignForm.scope === "department" ? "Avdelning" : "Område"}
                  </Label>
                  <Input
                    value={bulkAssignForm.scopeValue}
                    onChange={(e) => setBulkAssignForm((f) => ({ ...f, scopeValue: e.target.value }))}
                    placeholder="t.ex. Linje A"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Giltig från (valfritt)</Label>
                  <Input
                    type="date"
                    value={bulkAssignForm.validFrom}
                    onChange={(e) => setBulkAssignForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Giltig till (valfritt)</Label>
                  <Input
                    type="date"
                    value={bulkAssignForm.validTo}
                    onChange={(e) => setBulkAssignForm((f) => ({ ...f, validTo: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Anteckningar (valfritt)</Label>
                <Input
                  value={bulkAssignForm.notes}
                  onChange={(e) => setBulkAssignForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Anteckningar"
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
                <Label htmlFor="bulk-waived">Undantaget</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>Avbryt</Button>
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
                      toast({ title: json.error ?? "Misslyckades", variant: "destructive" });
                      return;
                    }
                    toast({ title: `Klar: ${json.inserted ?? 0} tillagda, ${json.updated ?? 0} uppdaterade` });
                    setBulkAssignDialogOpen(false);
                    setBulkAssignForm({ complianceCode: "", scope: "all", scopeValue: "", validFrom: "", validTo: "", notes: "", waived: false });
                    loadOverview();
                  } finally {
                    setBulkAssignSaving(false);
                  }
                }}
              >
                {bulkAssignSaving ? "Tilldelar…" : "Tilldela"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={packDialogOpen} onOpenChange={(o) => (!o && setSelectedPack(null), setPackDialogOpen(o))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedPack?.label ?? "Paket"}</DialogTitle>
              <DialogDescription>Tilldela alla poster i paketet till medarbetare.</DialogDescription>
            </DialogHeader>
            {selectedPack && (
              <>
                <div className="grid gap-2">
                  <Label>Inkluderade poster</Label>
                  <ul className="text-sm rounded-lg border bg-muted/20 divide-y divide-border/50">
                    {selectedPack.codes.map((code) => {
                      const catalogItem = data?.catalog?.find((c) => c.code === code);
                      return (
                        <li key={code} className="flex items-center justify-between gap-2 px-3 py-2">
                          {catalogItem ? (
                            <>
                              <div>
                                <span className="font-medium">{catalogItem.name}</span>
                                <span className="block text-xs text-muted-foreground">{catalogItem.code}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="font-medium text-muted-foreground">{code}</span>
                                <span className="block text-xs text-muted-foreground">Saknas i katalog (kan läggas till)</span>
                              </div>
                              {isAdminOrHr && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-primary hover:underline"
                                  onClick={() => {
                                    setCatalogForm((f) => ({ ...f, code }));
                                    setPackDialogOpen(false);
                                    setCatalogDialogOpen(true);
                                  }}
                                >
                                  Lägg till i katalog
                                </Button>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="grid gap-2">
                  <Label>Omfattning</Label>
                  <Select value={packForm.scope} onValueChange={(v) => setPackForm((f) => ({ ...f, scope: v as typeof packForm.scope }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla aktiva medarbetare</SelectItem>
                      <SelectItem value="line">Linje</SelectItem>
                      <SelectItem value="department">Avdelning</SelectItem>
                      <SelectItem value="area">Område</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {packForm.scope !== "all" && (
                  <div className="grid gap-2">
                    <Label>{packForm.scope === "line" ? "Linje" : packForm.scope === "department" ? "Avdelning" : "Område"}</Label>
                    <Input value={packForm.scopeValue} onChange={(e) => setPackForm((f) => ({ ...f, scopeValue: e.target.value }))} placeholder="t.ex. Linje A" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Giltig från (valfritt)</Label>
                    <Input type="date" value={packForm.validFrom} onChange={(e) => setPackForm((f) => ({ ...f, validFrom: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Giltig till (valfritt)</Label>
                    <Input type="date" value={packForm.validTo} onChange={(e) => setPackForm((f) => ({ ...f, validTo: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Anteckningar (valfritt)</Label>
                  <Input value={packForm.notes} onChange={(e) => setPackForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Anteckningar" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="pack-waived" checked={packForm.waived} onChange={(e) => setPackForm((f) => ({ ...f, waived: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <Label htmlFor="pack-waived">Undantaget</Label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPackDialogOpen(false)}>Avbryt</Button>
                  <Button
                    disabled={(packForm.scope !== "all" && !packForm.scopeValue.trim()) || packSubmitting}
                    onClick={async () => {
                      if (!selectedPack) return;
                      setPackSubmitting(true);
                      let ti = 0, tu = 0;
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
                        toast({ title: `Paket tilldelat: ${ti} tillagda, ${tu} uppdaterade` });
                        loadOverview();
                      } finally {
                        setPackSubmitting(false);
                      }
                    }}
                  >
                    {packSubmitting ? "Tilldelar…" : "Tilldela paket"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lägg till katalogpost</DialogTitle>
              <DialogDescription>Skapa en compliancetyp. Koden måste vara unik.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Kod</Label>
                <Input value={catalogForm.code} onChange={(e) => setCatalogForm((f) => ({ ...f, code: e.target.value }))} placeholder="t.ex. FORKLIFT_A" />
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
                    <SelectItem value="medical">Medicinsk</SelectItem>
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
                <Input type="number" value={catalogForm.default_validity_days} onChange={(e) => setCatalogForm((f) => ({ ...f, default_validity_days: e.target.value }))} placeholder="365" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>Avbryt</Button>
              <Button
                disabled={!catalogForm.code.trim() || !catalogForm.name.trim() || catalogSaving}
                onClick={async () => {
                  setCatalogSaving(true);
                  try {
                    const res = await fetch("/api/compliance/catalog/upsert", {
                      method: "POST",
                      credentials: "include",
                      headers: withDevBearer({ "Content-Type": "application/json" }),
                      body: JSON.stringify({
                        code: catalogForm.code.trim(),
                        name: catalogForm.name.trim(),
                        category: catalogForm.category,
                        description: catalogForm.description?.trim() || null,
                        default_validity_days: catalogForm.default_validity_days ? parseInt(catalogForm.default_validity_days, 10) : null,
                      }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      toast({ title: (json as { error?: string }).error ?? "Kunde inte spara", variant: "destructive" });
                      return;
                    }
                    toast({ title: "Katalogpost sparad" });
                    setCatalogDialogOpen(false);
                    setCatalogForm({ code: "", name: "", category: "license", description: "", default_validity_days: "" });
                    loadOverview();
                  } finally {
                    setCatalogSaving(false);
                  }
                }}
              >
                {catalogSaving ? "Sparar…" : "Spara"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OrgGuard>
  );
}
