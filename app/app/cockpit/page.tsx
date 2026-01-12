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
import { CalendarDays, Shield } from "lucide-react";
import { ActionsWidget } from "@/components/cockpit/ActionsWidget";
import { StaffingWidget } from "@/components/cockpit/StaffingWidget";
import { ComplianceWidget } from "@/components/cockpit/ComplianceWidget";
import { SafetyWidget } from "@/components/cockpit/SafetyWidget";
import { PlanActualWidget } from "@/components/cockpit/PlanActualWidget";
import { isDemoMode } from "@/lib/demoRuntime";
import {
  DEMO_ACTIONS,
  DEMO_COMPLIANCE,
  DEMO_SAFETY_OBSERVATIONS,
  DEMO_SHIFTS,
  getDemoStaffingCards,
  getDemoCockpitMetrics,
  getDemoPlanVsActual,
} from "@/lib/cockpitDemo";
import type {
  Action,
  ComplianceItem,
  SafetyObservation,
  Shift,
  StationStaffingCard,
  CockpitMetrics,
  PlanVsActual,
} from "@/types/cockpit";
import { useToast } from "@/hooks/use-toast";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demo = isDemoMode();
    setIsDemo(demo);
    
    if (demo) {
      setActions(DEMO_ACTIONS.filter(a => a.status === "open"));
      setStaffingCards(getDemoStaffingCards());
      setComplianceItems(DEMO_COMPLIANCE.filter(c => c.status === "expired" || c.status === "expiring_soon"));
      setSafetyObservations(DEMO_SAFETY_OBSERVATIONS);
      setShifts(DEMO_SHIFTS);
      setMetrics(getDemoCockpitMetrics());
      setPlanVsActual(getDemoPlanVsActual());
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const handleMarkActionDone = (actionId: string) => {
    if (isDemo) {
      setActions(prev => prev.filter(a => a.id !== actionId));
      toast({
        title: "Action completed",
        description: "The action has been marked as done.",
      });
    }
  };

  const handleCreateComplianceAction = (item: ComplianceItem) => {
    if (isDemo) {
      toast({
        title: "Action created",
        description: `Renewal action created for ${item.employeeName}'s ${item.title}`,
      });
    }
  };

  const handleCreateObservation = () => {
    if (isDemo) {
      toast({
        title: "Report observation",
        description: "Safety observation form would open here.",
      });
    }
  };

  const handleSuggestReplacement = (stationId: string) => {
    if (isDemo) {
      toast({
        title: "Finding replacement",
        description: "Searching for qualified employees...",
      });
    }
  };

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  const filteredStaffingCards = selectedLine === "all"
    ? staffingCards
    : staffingCards.filter(c => c.station.line === selectedLine);

  const lines = [...new Set(staffingCards.map(c => c.station.line).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {isDemo && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Demo Mode Active — Using sample data
          </span>
        </div>
      )}

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-cockpit">
            Today
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <CalendarDays className="h-4 w-4" />
            {today}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-[140px]" data-testid="select-shift">
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              {shifts.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  {shift.name} Shift
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLine} onValueChange={setSelectedLine}>
            <SelectTrigger className="w-[140px]" data-testid="select-line">
              <SelectValue placeholder="All lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {lines.map((line) => (
                <SelectItem key={line} value={line as string}>
                  {line}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Open Actions</p>
            <p className="text-2xl font-bold">{metrics.openActions}</p>
            {metrics.criticalActions > 0 && (
              <Badge variant="destructive" className="mt-1 text-xs">
                {metrics.criticalActions} critical
              </Badge>
            )}
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Staffing</p>
            <p className="text-2xl font-bold">
              {metrics.staffedStations}/{metrics.totalStations}
            </p>
            <p className="text-xs text-muted-foreground mt-1">stations covered</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Compliance</p>
            <p className="text-2xl font-bold text-orange-500">{metrics.expiringCompliance + metrics.overdueCompliance}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.overdueCompliance} overdue, {metrics.expiringCompliance} expiring
            </p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Safety</p>
            <p className="text-2xl font-bold">{metrics.safetyObservationsThisWeek}</p>
            <p className="text-xs text-muted-foreground mt-1">observations this week</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <ActionsWidget
            actions={actions}
            onMarkDone={handleMarkActionDone}
          />
        </div>

        <div className="lg:col-span-8">
          <StaffingWidget
            staffingCards={filteredStaffingCards}
            onSuggestReplacement={handleSuggestReplacement}
          />
        </div>

        <div className="lg:col-span-4">
          <ComplianceWidget
            items={complianceItems}
            onCreateAction={handleCreateComplianceAction}
          />
        </div>

        <div className="lg:col-span-4">
          <SafetyWidget
            observations={safetyObservations}
            openActionsCount={metrics?.openSafetyActions || 0}
            onCreateObservation={handleCreateObservation}
          />
        </div>

        <div className="lg:col-span-4">
          <PlanActualWidget data={planVsActual} />
        </div>
      </div>
    </div>
  );
}
