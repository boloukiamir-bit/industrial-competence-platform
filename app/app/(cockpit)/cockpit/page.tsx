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
import { CalendarDays } from "lucide-react";
import { PriorityFixesWidget } from "@/components/cockpit/PriorityFixesWidget";
import { ActionsWidget } from "@/components/cockpit/ActionsWidget";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import { StaffingWidget } from "@/components/cockpit/StaffingWidget";
import { ComplianceWidget } from "@/components/cockpit/ComplianceWidget";
import { SafetyWidget } from "@/components/cockpit/SafetyWidget";
import { PlanActualWidget } from "@/components/cockpit/PlanActualWidget";
import { HandoverWidget } from "@/components/cockpit/HandoverWidget";
import { ActionDrawer } from "@/components/cockpit/ActionDrawer";
import { StaffingSuggestModal } from "@/components/cockpit/StaffingSuggestModal";
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

export default function CockpitPage() {
  const { toast } = useToast();
  const [isDemo, setIsDemo] = useState(false);
  const [selectedShift, setSelectedShift] = useState("shift-day");
  const [selectedLine, setSelectedLine] = useState("all");
  
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

  // Load cockpit summary from execution_decisions
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    fetch("/api/cockpit/summary", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load summary");
        return res.json();
      })
      .then((data: CockpitSummaryResponse) => {
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
  }, []);

  // Load lines from DB
  useEffect(() => {
    async function loadLines() {
      try {
        const response = await fetch("/api/cockpit/lines", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableLines(data.lines || []);
        }
      } catch (error) {
        console.error("Failed to load lines:", error);
      }
    }
    loadLines();
  }, []);

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

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  const filteredStaffingCards = selectedLine === "all"
    ? staffingCards
    : staffingCards.filter(c => c.station.line === selectedLine);

  // Use lines from DB if available, otherwise fallback to lines from staffingCards
  const lines = availableLines.length > 0 
    ? availableLines 
    : [...new Set(staffingCards.map(c => c.station.line).filter(Boolean))];

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
            {today}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-[130px]" data-testid="select-shift">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              {shifts.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  {shift.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLine} onValueChange={setSelectedLine}>
            <SelectTrigger className="w-[130px]" data-testid="select-line">
              <SelectValue placeholder="Line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {lines.filter(line => line !== "Assembly").map((line) => (
                <SelectItem key={line} value={line as string}>
                  {line}
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
    </div>
  );
}
