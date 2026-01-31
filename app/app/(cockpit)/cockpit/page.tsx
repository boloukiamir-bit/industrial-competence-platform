"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { PriorityFixesWidget } from "@/components/cockpit/PriorityFixesWidget";
import { ActionsWidget } from "@/components/cockpit/ActionsWidget";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import { StaffingWidget } from "@/components/cockpit/StaffingWidget";
import { useCockpitFilters } from "@/lib/CockpitFilterContext";
import { ComplianceWidget } from "@/components/cockpit/ComplianceWidget";
import { SafetyWidget } from "@/components/cockpit/SafetyWidget";
import { PlanActualWidget } from "@/components/cockpit/PlanActualWidget";
import { HandoverWidget } from "@/components/cockpit/HandoverWidget";
import { ActionDrawer } from "@/components/cockpit/ActionDrawer";
import { StaffingSuggestModal } from "@/components/cockpit/StaffingSuggestModal";
import { LineRootCauseDrawer } from "@/components/line-overview/LineRootCauseDrawer";
import { isDemoMode } from "@/lib/demoRuntime";
import {
  DEMO_ACTIONS,
  DEMO_COMPLIANCE,
  DEMO_SAFETY_OBSERVATIONS,
  DEMO_SHIFTS,
  DEMO_STATIONS,
  DEMO_EMPLOYEES_COCKPIT,
  getDemoStaffingCards,
  getDemoCockpitMetrics,
  getDemoPlanVsActual,
  getDemoPriorityItems,
  getDemoActivityLog,
  getDemoEmployeeSuggestions,
  getDemoHandoverItems,
} from "@/lib/cockpitDemo";
import type {
  Action,
  ComplianceItem,
  SafetyObservation,
  Shift,
  Station,
  StationStaffingCard,
  CockpitMetrics,
  PlanVsActual,
  PriorityItem,
  ActivityLogEntry,
  EmployeeSuggestion,
  HandoverItem,
} from "@/types/cockpit";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/coreFetch";
import Link from "next/link";

type GapsLineRow = {
  lineCode: string;
  lineName: string;
  gapHours: number;
  competenceStatus: "NO-GO" | "WARNING" | "OK";
  eligibleOperatorsCount: number;
  root_cause?: { primary: string; causes: string[] };
  stations: Array<{ stationId: string; stationCode: string; stationName: string; requiredHours: number; assignedHours: number; gapHours: number }>;
  missing_skill_codes: string[];
  recommended_action: "assign" | "call_in" | "swap";
};

function CockpitSkeleton() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-pulse">
      <div className="h-8 w-48 bg-muted rounded mb-2" />
      <div className="h-4 w-32 bg-muted rounded mb-6" />
      <div className="h-32 bg-muted rounded-lg mb-6" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 h-64 bg-muted rounded-lg" />
        <div className="col-span-8 h-64 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

const SHIFT_OPTIONS = ["Day", "Evening", "Night"] as const;

export default function CockpitPage() {
  const { toast } = useToast();
  const { date, shiftType, line, setDate, setShiftType, setLine } = useCockpitFilters();
  const [isDemo, setIsDemo] = useState(false);
  
  const [actions, setActions] = useState<Action[]>([]);
  const [staffingCards, setStaffingCards] = useState<StationStaffingCard[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [safetyObservations, setSafetyObservations] = useState<SafetyObservation[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [metrics, setMetrics] = useState<CockpitMetrics | null>(null);
  const [planVsActual, setPlanVsActual] = useState<PlanVsActual[]>([]);
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [handoverData, setHandoverData] = useState<{ openLoops: HandoverItem[]; decisions: HandoverItem[]; risks: HandoverItem[] }>({ openLoops: [], decisions: [], risks: [] });
  const [loading, setLoading] = useState(true);

  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [availableLines, setAvailableLines] = useState<string[]>([]);

  const [summary, setSummary] = useState<CockpitSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [gapsLines, setGapsLines] = useState<GapsLineRow[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [rootCauseDrawerLine, setRootCauseDrawerLine] = useState<GapsLineRow | null>(null);

  // Load cockpit summary from execution_decisions (respects date/shift/line filters)
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (shiftType) params.set("shift", shiftType);
    if (line && line !== "all") params.set("line", line);
    const qs = params.toString();
    const url = `/api/cockpit/summary${qs ? `?${qs}` : ""}`;
    fetchJson<CockpitSummaryResponse>(url)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setSummaryError(friendly);
          setPageError(friendly);
          throw new Error(friendly);
        }
        return res.data;
      })
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setSummaryError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummaryError(err instanceof Error ? err.message : "Unable to load summary");
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => { cancelled = true; };
  }, [date, shiftType, line, toast]);

  // Load Tomorrow's Gaps (top risks) for same date/shift — same engine as Tomorrow's Gaps page
  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    setGapsLoading(true);
    const params = new URLSearchParams({ date, shift: shiftType.toLowerCase() });
    fetchJson<{ lines?: GapsLineRow[] }>(`/api/tomorrows-gaps?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setPageError(friendly);
          throw new Error(friendly);
        }
        return res.data;
      })
      .then((data) => {
        if (!cancelled) setGapsLines(data.lines ?? []);
      })
      .catch(() => {
        if (!cancelled) setGapsLines([]);
      })
      .finally(() => {
        if (!cancelled) setGapsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date, shiftType, toast]);

  const topRisks = gapsLines
    .filter((l) => l.competenceStatus === "NO-GO" || l.competenceStatus === "WARNING")
    .sort((a, b) => {
      if (a.competenceStatus !== b.competenceStatus) return a.competenceStatus === "NO-GO" ? -1 : 1;
      return b.gapHours - a.gapHours;
    })
    .slice(0, 5);

  // Load lines from DB
  useEffect(() => {
    async function loadLines() {
      try {
        const response = await fetchJson<{ lines?: string[] }>("/api/cockpit/lines");
        if (!response.ok) {
          const friendly = response.status === 401 ? "Invalid or expired session" : response.error;
          const toastMessage =
            response.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${response.status}) — ${response.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setPageError(friendly);
          throw new Error(friendly);
        }
        setAvailableLines(response.data.lines || []);
      } catch (error) {
        console.error("Failed to load lines:", error);
      }
    }
    loadLines();
  }, [toast]);

  useEffect(() => {
    const demo = isDemoMode();
    setIsDemo(demo);
    
    if (demo) {
      setTimeout(() => {
        setActions(DEMO_ACTIONS.filter(a => a.status === "open"));
        setStaffingCards(getDemoStaffingCards());
        setComplianceItems(DEMO_COMPLIANCE.filter(c => c.status === "expired" || c.status === "expiring_soon"));
        setSafetyObservations(DEMO_SAFETY_OBSERVATIONS);
        setShifts(DEMO_SHIFTS);
        setMetrics(getDemoCockpitMetrics());
        setPlanVsActual(getDemoPlanVsActual());
        setPriorityItems(getDemoPriorityItems());
        setHandoverData(getDemoHandoverItems());
        setLoading(false);
      }, 300);
    } else {
      setLoading(false);
    }
  }, []);

  const openActionDrawer = (action: Action) => {
    setSelectedAction(action);
    setActivityLog(getDemoActivityLog(action.id));
    setActionDrawerOpen(true);
  };

  const handleMarkActionDone = (actionId: string) => {
    setActions(prev => prev.filter(a => a.id !== actionId));
    setPriorityItems(prev => prev.filter(p => p.actionId !== actionId));
    setActionDrawerOpen(false);
    toast({ title: "Action completed", description: "The action has been marked as done." });
  };

  const handleReassign = (actionId: string, newOwnerId: string, newOwnerName: string) => {
    setActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, ownerId: newOwnerId, ownerName: newOwnerName } : a
    ));
    setActivityLog(prev => [{
      id: `log-${Date.now()}`,
      actionId,
      type: "reassigned",
      description: `Reassigned to ${newOwnerName}`,
      userName: "You",
      createdAt: new Date().toISOString(),
    }, ...prev]);
    toast({ title: "Action reassigned", description: `Assigned to ${newOwnerName}` });
  };

  const handleChangeDueDate = (actionId: string, newDate: string) => {
    setActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, dueDate: newDate } : a
    ));
    setActivityLog(prev => [{
      id: `log-${Date.now()}`,
      actionId,
      type: "due_date_changed",
      description: `Due date changed to ${format(new Date(newDate), "MMM d, yyyy")}`,
      userName: "You",
      createdAt: new Date().toISOString(),
    }, ...prev]);
    toast({ title: "Due date updated" });
  };

  const handleResolvePriority = (item: PriorityItem) => {
    const action = actions.find(a => 
      (item.type === 'staffing' && a.relatedStationId === item.linkedEntity?.id) ||
      (item.type === 'compliance' && a.relatedEmployeeId === item.linkedEntity?.id) ||
      (item.type === 'safety' && a.id === item.actionId)
    );
    
    if (action) {
      openActionDrawer(action);
    } else if (item.type === 'staffing' && item.linkedEntity) {
      const station = DEMO_STATIONS.find(s => s.id === item.linkedEntity?.id);
      if (station) {
        handleSuggestReplacement(station.id);
      }
    } else {
      toast({ title: "Opening resolution...", description: item.title });
    }
  };

  const handleSuggestReplacement = (stationId: string) => {
    const station = DEMO_STATIONS.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      setSuggestions(getDemoEmployeeSuggestions(stationId));
      setSuggestModalOpen(true);
    }
  };

  const handleApplySuggestion = (stationId: string, employeeId: string, employeeName: string) => {
    setStaffingCards(prev => prev.map(card => {
      if (card.station.id === stationId) {
        return {
          ...card,
          assignment: card.assignment ? { ...card.assignment, employeeId, employeeName, status: "assigned" as const } : undefined,
          employee: { id: employeeId, name: employeeName },
          complianceStatus: "green" as const,
        };
      }
      return card;
    }));
    setPriorityItems(prev => prev.filter(p => p.linkedEntity?.id !== stationId || p.type !== 'staffing'));
    setSuggestModalOpen(false);
    toast({ title: "Assignment updated", description: `${employeeName} assigned to ${selectedStation?.name}` });
  };

  const handleCreateComplianceAction = (item: ComplianceItem) => {
    toast({ title: "Action created", description: `Renewal action created for ${item.employeeName}'s ${item.title}` });
  };

  const handleCreateObservation = () => {
    toast({ title: "Report observation", description: "Safety observation form would open here." });
  };

  const handleGenerateHandover = () => {
    toast({ title: "Handover report generated", description: "PDF ready for download" });
  };

  const dateLabel = format(new Date(date + "T12:00:00"), "EEEE, MMMM d, yyyy");

  const filteredStaffingCards = line === "all"
    ? staffingCards
    : staffingCards.filter((c) => c.station.line === line);

  // Use lines from DB if available, otherwise fallback to lines from staffingCards
  const lines = availableLines.length > 0
    ? availableLines
    : [...new Set(staffingCards.map((c) => c.station.line).filter(Boolean))];

  if (pageError) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">{pageError}</p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <CockpitSkeleton />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-cockpit">
            Today
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
            <CalendarDays className="h-4 w-4" />
            {dateLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            data-testid="input-date"
          />
          <Select value={shiftType} onValueChange={(v) => setShiftType(v as typeof shiftType)}>
            <SelectTrigger className="w-[130px]" data-testid="select-shift">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={line} onValueChange={setLine}>
            <SelectTrigger className="w-[130px]" data-testid="select-line">
              <SelectValue placeholder="Line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {lines.filter((l) => l !== "Assembly").map((l) => (
                <SelectItem key={l} value={l as string}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="mb-6">
        <PriorityFixesWidget
          items={priorityItems}
          onResolve={handleResolvePriority}
          summary={summary}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          date={date}
          shiftType={shiftType}
        />
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open Actions</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold tabular-nums">{metrics.openActions}</p>
              {metrics.criticalActions > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {metrics.criticalActions} critical
                </Badge>
              )}
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staffing</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-bold tabular-nums">{metrics.staffedStations}</p>
              <p className="text-lg text-muted-foreground">/ {metrics.totalStations}</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compliance</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold tabular-nums text-orange-500">{metrics.expiringCompliance + metrics.overdueCompliance}</p>
              <span className="text-xs text-muted-foreground">
                {metrics.overdueCompliance} overdue
              </span>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Safety</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold tabular-nums">{metrics.safetyObservationsThisWeek}</p>
              <span className="text-xs text-muted-foreground">this week</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <div className="lg:col-span-4 space-y-4 lg:space-y-6">
          <ActionsWidget
            actions={actions}
            onMarkDone={handleMarkActionDone}
            onActionClick={openActionDrawer}
            summary={summary}
            summaryLoading={summaryLoading}
            summaryError={summaryError}
          />
          <HandoverWidget
            openLoops={handoverData.openLoops}
            decisions={handoverData.decisions}
            risks={handoverData.risks}
            onGenerateHandover={handleGenerateHandover}
          />
        </div>

        <div className="lg:col-span-8 space-y-4 lg:space-y-6">
          <StaffingWidget
            staffingCards={filteredStaffingCards}
            onSuggestReplacement={handleSuggestReplacement}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComplianceWidget
              items={complianceItems}
              onCreateAction={handleCreateComplianceAction}
            />
            <SafetyWidget
              observations={safetyObservations}
              openActionsCount={metrics?.openSafetyActions || 0}
              onCreateObservation={handleCreateObservation}
            />
            <PlanActualWidget data={planVsActual} />
          </div>
        </div>
      </div>

      <ActionDrawer
        action={selectedAction}
        open={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        onMarkDone={handleMarkActionDone}
        onReassign={handleReassign}
        onChangeDueDate={handleChangeDueDate}
        activityLog={activityLog}
        availableOwners={DEMO_EMPLOYEES_COCKPIT}
      />

      <StaffingSuggestModal
        station={selectedStation}
        open={suggestModalOpen}
        onClose={() => setSuggestModalOpen(false)}
        suggestions={suggestions}
        onApply={handleApplySuggestion}
      />

      <LineRootCauseDrawer
        open={rootCauseDrawerLine !== null}
        onOpenChange={(open) => !open && setRootCauseDrawerLine(null)}
        line={rootCauseDrawerLine}
        date={date}
        shift={shiftType}
      />
    </div>
  );
}
