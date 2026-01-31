"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, ExternalLink, Check, Stethoscope } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { toQueryShiftType } from "@/lib/shiftType";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useOrg } from "@/hooks/useOrg";
import { LineRootCauseDrawer } from "@/components/line-overview/LineRootCauseDrawer";
import { SuggestModal } from "@/components/line-overview/SuggestModal";
import { fetchLineOverviewData } from "@/services/lineOverview";
import type { MachineWithData, ShiftType } from "@/types/lineOverview";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/coreFetch";

function getTomorrowDateString(): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function formatSelectedDateLabel(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export type TomorrowsGapsLineRow = {
  lineCode: string;
  lineName: string;
  requiredHours: number;
  assignedHours: number;
  gapHours: number;
  competenceStatus: "NO-GO" | "WARNING" | "OK";
  eligibleOperatorsCount: number;
  requiredSkills: { code: string; name: string }[];
  eligibleOperators: { employee_number: string; name: string }[];
  resolved?: boolean;
  root_cause?: { primary: string; causes: string[] };
  stations: Array<{ stationId: string; stationCode: string; stationName: string; requiredHours: number; assignedHours: number; gapHours: number }>;
  missing_skill_codes: string[];
  recommended_action: "assign" | "call_in" | "swap";
};

const DECISION_OPTIONS: { value: string; label: string }[] = [
  { value: "swap_operator", label: "Swap" },
  { value: "call_in", label: "Call in" },
  { value: "accept_risk", label: "Accept risk" },
  { value: "acknowledged", label: "Acknowledged" },
];

function CompetenceBadge({ status }: { status: "NO-GO" | "WARNING" | "OK" }) {
  const variants: Record<string, string> = {
    "NO-GO": "hr-risk-pill hr-risk-pill--high",
    WARNING: "hr-risk-pill hr-risk-pill--medium",
    OK: "hr-risk-pill hr-risk-pill--low",
  };
  return (
    <span className={variants[status] || "hr-risk-pill"} data-testid={`competence-badge-${status}`}>
      {status}
    </span>
  );
}

function LineCard({
  line,
  date,
  shift,
  onResolve,
  onViewRootCause,
}: {
  line: TomorrowsGapsLineRow;
  date: string;
  shift: string;
  onResolve: (line: TomorrowsGapsLineRow) => void;
  onViewRootCause: (line: TomorrowsGapsLineRow) => void;
}) {
  const coveragePercent =
    line.requiredHours > 0
      ? Math.min(Math.round((line.assignedHours / line.requiredHours) * 100), 100)
      : 100;
  const showResolve =
    (line.competenceStatus === "NO-GO" || line.competenceStatus === "WARNING") && !line.resolved;
  const showViewRootCause = (line.competenceStatus === "NO-GO" || line.competenceStatus === "WARNING");

  const lineOverviewParams = new URLSearchParams();
  lineOverviewParams.set("date", date);
  lineOverviewParams.set("shift", shift.toLowerCase());
  lineOverviewParams.set("line", line.lineCode);

  return (
    <div className="hr-card" data-testid={`card-line-${line.lineCode}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 className="hr-card__title">{line.lineName}</h3>
        <div className="flex items-center gap-2">
          {line.resolved && (
            <span
              className="text-xs font-medium rounded-full px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
              data-testid={`resolved-badge-${line.lineCode}`}
            >
              <Check className="h-3 w-3 inline mr-0.5" />
              Resolved
            </span>
          )}
          <CompetenceBadge status={line.competenceStatus} />
        </div>
      </div>

      <div className="hr-emp-summary-grid">
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Required (h)</span>
          <span className="hr-emp-summary-value">{line.requiredHours.toFixed(1)}</span>
        </div>
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Assigned (h)</span>
          <span className="hr-emp-summary-value">{line.assignedHours.toFixed(1)}</span>
        </div>
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Gap (h)</span>
          <span
            className={`hr-emp-summary-value ${line.gapHours > 0 ? "text-red-600 dark:text-red-400" : ""}`}
          >
            {line.gapHours.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm text-muted-foreground">Coverage</span>
          <span className="text-sm font-medium">{coveragePercent}%</span>
        </div>
        <Progress value={coveragePercent} className="h-2" />
      </div>

      {line.requiredSkills.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Required skills</p>
          <ul className="text-sm space-y-0.5">
            {line.requiredSkills.map((s, idx) => (
              <li key={`${s.code}-${idx}`}>
                <span className="font-medium">{s.code}</span>
                {s.name !== s.code && <span className="text-muted-foreground"> — {s.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {line.eligibleOperators.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Eligible operators</p>
          <ul className="text-sm space-y-0.5">
            {line.eligibleOperators.slice(0, 5).map((op, idx) => (
              <li key={`${op.employee_number}-${idx}`}>
                <span className="font-medium">{op.employee_number}</span>
                {op.name && <span className="text-muted-foreground"> — {op.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2">
        {showViewRootCause && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onViewRootCause(line)}
            data-testid={`button-view-root-cause-${line.lineCode}`}
          >
            <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
            View root cause
          </Button>
        )}
        {showResolve && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onResolve(line)}
            data-testid={`button-resolve-${line.lineCode}`}
          >
            Resolve
          </Button>
        )}
        <Link
          href={`/app/line-overview?${lineOverviewParams.toString()}`}
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          data-testid={`link-line-overview-${line.lineCode}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Line Overview
        </Link>
      </div>
    </div>
  );
}

function ResolveModal({
  open,
  onOpenChange,
  line,
  date,
  shift,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: TomorrowsGapsLineRow | null;
  date: string;
  shift: string;
  onSaved: () => void;
}) {
  const [decisionType, setDecisionType] = useState("accept_risk");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setDecisionType("accept_risk");
      setNote("");
      setSaveError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!line) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetchJson("/api/tomorrows-gaps/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          shift,
          line: line.lineCode,
          decision_type: decisionType,
          note: note.trim() || undefined,
          root_cause: line.root_cause ?? undefined,
        }),
      });
      if (!res.ok) {
        const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
        const toastMessage =
          res.status === 401
            ? "Request failed (401) — Session expired. Please reload/login."
            : `Request failed (${res.status}) — ${res.error}`;
        toast({ title: toastMessage, variant: "destructive" });
        throw new Error(friendly);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve line</DialogTitle>
          <DialogDescription>
            {line ? `${line.lineName} — record decision for ${date} ${shift}` : ""}
          </DialogDescription>
        </DialogHeader>
        {line && (
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="tg-decision-type">Decision type</Label>
              <select
                id="tg-decision-type"
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-decision-type"
              >
                {DECISION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tg-resolve-note">Note (optional)</Label>
              <Textarea
                id="tg-resolve-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context..."
                className="mt-1 min-h-[80px]"
                data-testid="input-resolve-note"
              />
            </div>
            {saveError && (
              <p className="text-sm text-destructive" data-testid="resolve-save-error">
                {saveError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                data-testid="button-resolve-save"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TomorrowsGapsPage() {
  const { loading: authLoading } = useAuthGuard();

  if (authLoading) {
    return (
      <main className="hr-page">
        <p>Checking access...</p>
      </main>
    );
  }

  return <TomorrowsGapsContent />;
}

function TomorrowsGapsContent() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [lines, setLines] = useState<string[]>([]);
  const [data, setData] = useState<TomorrowsGapsLineRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getTomorrowDateString());
  const [selectedShift, setSelectedShift] = useState<string>("Day");
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [showResolved, setShowResolved] = useState(false);
  const [resolveModalLine, setResolveModalLine] = useState<TomorrowsGapsLineRow | null>(null);
  const [rootCauseDrawerLine, setRootCauseDrawerLine] = useState<TomorrowsGapsLineRow | null>(null);
  const [suggestMachine, setSuggestMachine] = useState<MachineWithData | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [loadingLines, setLoadingLines] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleStationClickFromRootCause = async (station: {
    stationId: string;
    stationCode: string;
    stationName: string;
    gapHours: number;
  }) => {
    const line = rootCauseDrawerLine;
    if (!line || !currentOrg || !selectedDate) return;

    const stationId = station.stationId?.trim();
    if (!stationId) {
      console.warn("[tomorrows-gaps] Station missing id — data needs reimport", {
        stationCode: station.stationCode,
        stationName: station.stationName,
        lineCode: line.lineCode,
      });
      toast({
        title: "Station missing id — data needs reimport",
        description: "Re-import or re-sync stations so every station has an id.",
        variant: "destructive",
      });
      return;
    }

    setSuggestLoading(true);
    try {
      const overview = await fetchLineOverviewData(selectedDate, selectedShift as ShiftType);
      const lineData = overview.lines.find((l) => l.line.lineCode === line.lineCode);
      const machine = lineData?.machines.find((m) => m.machine.stationId === stationId);
      if (!machine) {
        toast({
          title: "Station not found",
          description: "Could not load station data for assignment. Try Line Overview for this line.",
          variant: "destructive",
        });
        return;
      }
      setRootCauseDrawerLine(null);
      setSuggestMachine(machine);
    } catch (err) {
      console.error("Failed to load line overview for station:", err);
      toast({
        title: "Failed to load station",
        description: err instanceof Error ? err.message : "Try again or use Line Overview.",
        variant: "destructive",
      });
    } finally {
      setSuggestLoading(false);
    }
  };

  useEffect(() => {
    if (!currentOrg) {
      setLines([]);
      setLoadingLines(false);
      return;
    }
    setLoadingLines(true);
    fetchJson<{ lines?: string[] }>("/api/tomorrows-gaps/lines")
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          throw new Error(friendly);
        }
        setLines(res.data.lines ?? []);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load lines.");
      })
      .finally(() => setLoadingLines(false));
  }, [currentOrg, toast]);

  useEffect(() => {
    if (!currentOrg || !selectedDate) {
      setData([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    setError(null);
    const params = new URLSearchParams({ date: selectedDate, shift: selectedShift.toLowerCase() });
    if (selectedLine) params.set("line", selectedLine);
    fetchJson<{ lines?: TomorrowsGapsLineRow[] }>(`/api/tomorrows-gaps?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          throw new Error(friendly);
        }
        setData(res.data.lines ?? []);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load gap analysis data. Please try again.");
      })
      .finally(() => setLoadingData(false));
  }, [currentOrg, selectedDate, selectedShift, selectedLine, toast]);

  const fetchData = () => {
    if (!currentOrg || !selectedDate) return;
    const params = new URLSearchParams({ date: selectedDate, shift: selectedShift.toLowerCase() });
    if (selectedLine) params.set("line", selectedLine);
    fetchJson<{ lines?: TomorrowsGapsLineRow[] }>(`/api/tomorrows-gaps?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          throw new Error(friendly);
        }
        setData(res.data.lines ?? []);
      })
      .catch(() => {});
  };

  const visibleData = showResolved ? data : data.filter((l) => !l.resolved);
  const totalRequired = data.reduce((sum, l) => sum + l.requiredHours, 0);
  const hasNoDemand = data.length === 0 || totalRequired === 0;
  const noGoCount = data.filter((l) => l.competenceStatus === "NO-GO").length;
  const warningCount = data.filter((l) => l.competenceStatus === "WARNING").length;
  const okCount = data.filter((l) => l.competenceStatus === "OK").length;
  const totalGapHours = data.reduce((sum, l) => sum + l.gapHours, 0);

  if (loadingLines) {
    return (
      <main className="hr-page">
        <header className="hr-page__header">
          <div>
            <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
            <p className="hr-page__subtitle">
              Line coverage and competence status by date and shift.
            </p>
          </div>
        </header>
        <div className="flex justify-center gap-3 p-12">
          <Loader2 className="h-5 w-5 animate-spin" data-testid="loading-spinner" />
          <span className="text-muted-foreground">Loading lines...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="hr-page">
        <header className="hr-page__header">
          <div>
            <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
            <p className="hr-page__subtitle">
              Line coverage and competence status by date and shift.
            </p>
          </div>
        </header>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-destructive mb-2" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="hr-page">
      <header className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
          <p className="hr-page__subtitle">
            Line coverage and competence status by date and shift.
          </p>
          <p className="text-sm text-muted-foreground mt-1" data-testid="target-date-label">
            Target date: {formatSelectedDateLabel(selectedDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex flex-col gap-1" data-testid="date-pill">
            <Label htmlFor="tg-date" className="text-sm font-medium text-muted-foreground">
              Date
            </Label>
            <input
              id="tg-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
              data-testid="input-date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="tg-shift" className="text-sm font-medium text-muted-foreground">
              Shift
            </Label>
            <select
              id="tg-shift"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
              data-testid="select-shift"
            >
              <option value="Day">Day</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="tg-line" className="text-sm font-medium text-muted-foreground">
              Line
            </Label>
            <select
              id="tg-line"
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm min-w-[140px]"
              data-testid="select-line"
            >
              <option value="">All lines</option>
              {lines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-input"
              data-testid="toggle-show-resolved"
            />
            Show resolved
          </label>
        </div>
      </header>

      <ResolveModal
        open={resolveModalLine !== null}
        onOpenChange={(open) => !open && setResolveModalLine(null)}
        line={resolveModalLine}
        date={selectedDate}
        shift={selectedShift}
        onSaved={fetchData}
      />

      <LineRootCauseDrawer
        open={rootCauseDrawerLine !== null}
        onOpenChange={(open) => !open && setRootCauseDrawerLine(null)}
        line={rootCauseDrawerLine ?? null}
        date={selectedDate}
        shift={selectedShift}
        onResolve={(line) => {
          setRootCauseDrawerLine(null);
          setResolveModalLine(line as TomorrowsGapsLineRow);
        }}
        onStationClick={suggestLoading ? undefined : handleStationClickFromRootCause}
      />

      <SuggestModal
        open={suggestMachine !== null}
        onOpenChange={(open) => {
          if (!open) setSuggestMachine(null);
        }}
        machine={suggestMachine}
        planDate={selectedDate}
        shiftType={selectedShift as ShiftType}
        onApply={() => {
          fetchData();
        }}
      />

      {loadingData ? (
        <div className="flex justify-center gap-3 p-12">
          <Loader2 className="h-5 w-5 animate-spin" data-testid="loading-spinner" />
          <span className="text-muted-foreground">Calculating gaps...</span>
        </div>
      ) : hasNoDemand ? (
        <div className="hr-empty mt-6" data-testid="empty-state">
          <p className="font-medium mb-2">
            No demand found for {selectedDate} {selectedShift}. Generate demand in Line Overview.
          </p>
          <Link
            href={
              lines.length > 0
                ? `/app/line-overview?date=${selectedDate}&shift=${toQueryShiftType(selectedShift as "Day" | "Evening" | "Night")}&line=${encodeURIComponent(lines[0])}`
                : `/app/line-overview?date=${selectedDate}&shift=${toQueryShiftType(selectedShift as "Day" | "Evening" | "Night")}`
            }
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="empty-cta-line-overview"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Go to Line Overview
          </Link>
        </div>
      ) : (
        <>
          <div className="hr-kpi-grid mt-6" data-testid="summary-kpis">
            <div className="hr-kpi">
              <span className="hr-kpi__label">Lines</span>
              <span className="hr-kpi__value">{data.length}</span>
            </div>
            <div className="hr-kpi">
              <span className="hr-kpi__label">NO-GO</span>
              <span
                className={`hr-kpi__value ${noGoCount > 0 ? "hr-kpi__value--danger" : ""}`}
              >
                {noGoCount}
              </span>
            </div>
            <div className="hr-kpi">
              <span className="hr-kpi__label">WARNING</span>
              <span
                className={`hr-kpi__value ${warningCount > 0 ? "hr-kpi__value--warn" : ""}`}
              >
                {warningCount}
              </span>
            </div>
            <div className="hr-kpi">
              <span className="hr-kpi__label">OK</span>
              <span className="hr-kpi__value hr-kpi__value--ok">{okCount}</span>
            </div>
            <div className="hr-kpi">
              <span className="hr-kpi__label">Total gap (h)</span>
              <span
                className={`hr-kpi__value ${totalGapHours > 0 ? "hr-kpi__value--danger" : ""}`}
              >
                {totalGapHours.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="hr-grid mt-6" data-testid="lines-grid">
            {visibleData.map((line) => (
              <LineCard
                key={line.lineCode}
                line={line}
                date={selectedDate}
                shift={selectedShift}
                onResolve={setResolveModalLine}
                onViewRootCause={setRootCauseDrawerLine}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
