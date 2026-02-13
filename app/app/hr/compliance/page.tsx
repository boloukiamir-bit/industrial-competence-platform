"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageFrame } from "@/components/layout/PageFrame";
import { fetchJson } from "@/lib/coreFetch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ComplianceItem = {
  code: string;
  name: string;
  status: "MISSING" | "EXPIRED";
  valid_to: string | null;
  days_left: number | null;
};

type EmployeeBlocker = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  items: ComplianceItem[];
};

type ComplianceDrilldownResponse = {
  ok: true;
  station_id: string;
  shift_date: string;
  shift_code: string;
  blockers: EmployeeBlocker[];
};

function parseEmployeeIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function statusRank(status: ComplianceItem["status"]): number {
  return status === "MISSING" ? 0 : 1;
}

function dateToIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export default function HrCompliancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const employeeIds = useMemo(
    () => parseEmployeeIds(searchParams.get("employee_id")),
    [searchParams]
  );
  const date = searchParams.get("date")?.trim() ?? "";
  const shiftCode = searchParams.get("shift_code")?.trim() ?? "";
  const stationId = searchParams.get("station_id")?.trim() ?? "";
  const returnHref = searchParams.get("return")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<EmployeeBlocker[]>([]);
  const [itemLoading, setItemLoading] = useState<Record<string, "valid" | "waive">>({});
  const [validDialogOpen, setValidDialogOpen] = useState(false);
  const [validTarget, setValidTarget] = useState<{ employee_id: string; employee_name: string; code: string; name: string } | null>(null);
  const [validFrom, setValidFrom] = useState(() => todayPlus(0));
  const [validTo, setValidTo] = useState(() => todayPlus(365));
  const [validNotes, setValidNotes] = useState("");
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [waiveTarget, setWaiveTarget] = useState<{ employee_id: string; employee_name: string; code: string; name: string } | null>(null);

  const loadDrilldown = useCallback(async () => {
    if (!date || !shiftCode || !stationId) {
      setError("Missing required query params: date, shift_code, station_id.");
      setBlockers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      date,
      shift_code: shiftCode,
      station_id: stationId,
    });
    fetchJson<ComplianceDrilldownResponse>(`/api/cockpit/issues/compliance-drilldown?${params.toString()}`)
      .then((res) => {
        if (!res.ok || !res.data?.ok) {
          setError(res.ok ? "Failed to load compliance drilldown" : res.error);
          setBlockers([]);
          return;
        }
        let next = res.data.blockers ?? [];
        if (employeeIds.length > 0) {
          const set = new Set(employeeIds);
          next = next.filter((b) => set.has(b.employee_id));
        }
        next = next.map((b) => ({
          ...b,
          items: [...b.items].sort((a, z) => {
            const s = statusRank(a.status) - statusRank(z.status);
            if (s !== 0) return s;
            return (a.name || a.code).localeCompare(z.name || z.code);
          }),
        }));
        next.sort((a, b) => {
          const aMissing = a.items.filter((i) => i.status === "MISSING").length;
          const bMissing = b.items.filter((i) => i.status === "MISSING").length;
          if (aMissing !== bMissing) return bMissing - aMissing;
          if (a.items.length !== b.items.length) return b.items.length - a.items.length;
          return a.employee_name.localeCompare(b.employee_name);
        });
        setBlockers(next);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load compliance drilldown");
        setBlockers([]);
      })
      .finally(() => setLoading(false));
  }, [date, shiftCode, stationId, employeeIds]);

  useEffect(() => {
    void loadDrilldown();
  }, [loadDrilldown]);

  const contextBadges = [
    { label: stationId ? `Station ${stationId}` : "Station —", className: "bg-muted text-muted-foreground" },
    { label: shiftCode ? `Shift ${shiftCode}` : "Shift —", className: "bg-muted text-muted-foreground" },
    { label: date || "Date —", className: "bg-muted text-muted-foreground" },
  ];

  const isAllClear = !loading && !error && blockers.length === 0;
  const backHref = useMemo(() => {
    if (!returnHref) return "";
    const [path, query] = returnHref.split("?");
    const params = new URLSearchParams(query ?? "");
    if (isAllClear) params.set("refresh", "1");
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
  }, [returnHref, isAllClear]);

  const openMarkValid = (employee: EmployeeBlocker, item: ComplianceItem) => {
    setValidTarget({
      employee_id: employee.employee_id,
      employee_name: employee.employee_name,
      code: item.code,
      name: item.name,
    });
    setValidFrom(todayPlus(0));
    setValidTo(todayPlus(365));
    setValidNotes("");
    setValidDialogOpen(true);
  };

  const openWaive = (employee: EmployeeBlocker, item: ComplianceItem) => {
    setWaiveTarget({
      employee_id: employee.employee_id,
      employee_name: employee.employee_name,
      code: item.code,
      name: item.name,
    });
    setWaiveDialogOpen(true);
  };

  const submitMarkValid = async () => {
    if (!validTarget) return;
    const key = `${validTarget.employee_id}:${validTarget.code}`;
    setItemLoading((prev) => ({ ...prev, [key]: "valid" }));
    try {
      const res = await fetchJson<{ ok?: boolean; error?: string }>("/api/compliance/employee/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: validTarget.employee_id,
          compliance_code: validTarget.code,
          valid_from: validFrom,
          valid_to: validTo,
          notes: validNotes || null,
          waived: false,
        }),
      });
      if (!res.ok || !res.data?.ok) {
        throw new Error(res.ok ? res.data?.error ?? "Failed to update compliance" : res.error);
      }
      toast({ title: "Compliance updated", description: `${validTarget.name} marked as valid.` });
      setValidDialogOpen(false);
      setValidTarget(null);
      await loadDrilldown();
    } catch (err) {
      toast({
        title: "Failed to update compliance",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setItemLoading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const submitWaive = async () => {
    if (!waiveTarget) return;
    const key = `${waiveTarget.employee_id}:${waiveTarget.code}`;
    setItemLoading((prev) => ({ ...prev, [key]: "waive" }));
    try {
      const res = await fetchJson<{ ok?: boolean; error?: string }>("/api/compliance/employee/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: waiveTarget.employee_id,
          compliance_code: waiveTarget.code,
          waived: true,
        }),
      });
      if (!res.ok || !res.data?.ok) {
        throw new Error(res.ok ? res.data?.error ?? "Failed to waive compliance" : res.error);
      }
      toast({ title: "Compliance waived", description: `${waiveTarget.name} waived for ${waiveTarget.employee_name}.` });
      setWaiveDialogOpen(false);
      setWaiveTarget(null);
      await loadDrilldown();
    } catch (err) {
      toast({
        title: "Failed to waive compliance",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setItemLoading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  return (
    <PageFrame>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Compliance control room
            </p>
            <h1 className="text-xl font-semibold text-foreground">Blocking compliance items</h1>
            <div className="flex flex-wrap gap-2">
              {contextBadges.map((b) => (
                <span
                  key={b.label}
                  className={cn("text-[11px] font-medium rounded-md px-2 py-1", b.className)}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          {backHref ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 text-[0.8125rem]"
              onClick={() => router.push(backHref)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to cockpit
            </Button>
          ) : null}
        </header>

        {loading ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 py-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <div>
                <p className="text-[0.8125rem] font-medium text-destructive">Could not load compliance blockers</p>
                <p className="text-[0.6875rem] text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        ) : blockers.length === 0 ? (
          <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-5 text-[0.875rem] text-emerald-900 dark:text-emerald-100">
            All clear — no blocking compliance items for the selected scope.
          </div>
        ) : (
          <div className="grid gap-4">
            {blockers.map((emp) => (
              <section
                key={emp.employee_id}
                className="rounded-xl border border-red-200/70 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-foreground">{emp.employee_name}</p>
                    {emp.employee_number && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{emp.employee_number}</p>
                    )}
                  </div>
                  <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                    Blocking
                  </Badge>
                </div>
                <ul className="mt-3 space-y-2">
                  {emp.items.map((item) => (
                    <li
                      key={`${emp.employee_id}-${item.code}`}
                      className="flex items-center justify-between gap-3 py-2 text-[0.8125rem] border-b border-border/40 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{item.name || item.code}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.code}
                          {item.valid_to ? ` · valid to ${item.valid_to}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                          {item.status}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[0.6875rem]"
                          disabled={Boolean(itemLoading[`${emp.employee_id}:${item.code}`])}
                          onClick={() => openMarkValid(emp, item)}
                        >
                          {itemLoading[`${emp.employee_id}:${item.code}`] === "valid" ? "Saving…" : "Mark as valid"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-[0.6875rem]"
                          disabled={Boolean(itemLoading[`${emp.employee_id}:${item.code}`])}
                          onClick={() => openWaive(emp, item)}
                        >
                          {itemLoading[`${emp.employee_id}:${item.code}`] === "waive" ? "Waiving…" : "Waive"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={validDialogOpen} onOpenChange={setValidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as valid</DialogTitle>
            <DialogDescription>
              {validTarget ? `${validTarget.employee_name} · ${validTarget.name}` : "Update validity period."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="valid_from">Valid from</Label>
              <Input id="valid_from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valid_to">Valid to</Label>
              <Input id="valid_to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valid_notes">Notes (optional)</Label>
              <Textarea id="valid_notes" value={validNotes} onChange={(e) => setValidNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setValidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitMarkValid} variant="default">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waiveDialogOpen} onOpenChange={setWaiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Waive requirement</DialogTitle>
            <DialogDescription>
              Waive this requirement for this employee?
              {waiveTarget ? ` (${waiveTarget.employee_name} · ${waiveTarget.name})` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitWaive}>
              Waive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
