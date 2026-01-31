"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Zap, User, Clock, Check, ChevronDown, ChevronRight, Search } from "lucide-react";
import type { MachineWithData, ShiftType, EmployeeSuggestion } from "@/types/lineOverview";
import { getSuggestions, createAssignment } from "@/services/lineOverview";
import { useToast } from "@/hooks/use-toast";
import { addHoursToTime } from "@/lib/lineOverviewNet";

/** Derive a short reason key for ineligible grouping (stations/skills). */
function ineligibleReasonKey(s: EmployeeSuggestion): string {
  const stations = `Stations ${s.stationsPassed}/${s.stationsRequired}`;
  const skills =
    typeof s.requiredSkillsCount === "number" && s.requiredSkillsCount > 0
      ? `, Skills ${s.skillsPassedCount ?? 0}/${s.requiredSkillsCount}`
      : "";
  return stations + skills;
}

interface SuggestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: MachineWithData | null;
  planDate: string;
  shiftType: ShiftType;
  onApply: () => void;
}

const shiftTimes: Record<ShiftType, { start: string; end: string }> = {
  Day: { start: "07:00", end: "16:00" },
  Evening: { start: "14:00", end: "23:00" },
  Night: { start: "23:00", end: "07:00" },
};

export function SuggestModal({
  open,
  onOpenChange,
  machine,
  planDate,
  shiftType,
  onApply,
}: SuggestModalProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"eligible" | "ineligible">("eligible");
  const [openIneligibleReasons, setOpenIneligibleReasons] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && machine) {
      setSearchQuery("");
      setActiveTab("eligible");
      setOpenIneligibleReasons(new Set());
      loadSuggestions();
    }
  }, [open, machine, planDate, shiftType]);

  const loadSuggestions = async () => {
    if (!machine) return;

    setLoading(true);
    try {
      const hoursNeeded = Math.min(machine.gap, 8);
      const results = await getSuggestions(
        machine.machine.lineCode,
        machine.machine.machineCode,
        planDate,
        shiftType,
        hoursNeeded
      );
      setSuggestions(results);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
      toast({ title: "Failed to load suggestions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (suggestion: EmployeeSuggestion) => {
    if (!machine) return;

    setApplying(suggestion.employee.employeeNumber);

    const hoursNeeded = Math.min(machine.gap, 8);
    const duration = Math.min(hoursNeeded, suggestion.availableHours);
    const shiftStart = shiftTimes[shiftType].start;
    const endTime = addHoursToTime(shiftStart, duration);

    try {
      const result = await createAssignment({
        date: planDate,
        shift: shiftType,
        stationId: machine.machine.stationId ?? machine.machine.id,
        machineCode: machine.machine.machineCode,
        employeeCode: suggestion.employee.employeeNumber,
        startTime: shiftStart,
        endTime,
      });

      if (result) {
        toast({
          title: "Assignment created",
          description: `${suggestion.employee.fullName} assigned ${shiftStart}–${endTime}`,
        });
        onApply();
        onOpenChange(false);
      } else {
        toast({ title: "Failed to create assignment", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Error creating assignment",
        variant: "destructive",
      });
    } finally {
      setApplying(null);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (s: EmployeeSuggestion) => {
    if (!q) return true;
    const name = (s.employee?.fullName ?? "").toLowerCase();
    const num = (s.employee?.employeeNumber ?? s.employee?.employeeCode ?? "").toLowerCase();
    return name.includes(q) || num.includes(q);
  };

  const { eligibleList, ineligibleList, ineligibleByReason } = useMemo(() => {
    const eligible = suggestions
      .filter((s) => s.eligible && matchesSearch(s))
      .sort((a, b) => {
        if (typeof a.score === "number" && typeof b.score === "number" && a.score !== b.score) {
          return b.score - a.score;
        }
        const nameA = (a.employee?.fullName ?? a.employee?.employeeCode ?? "").toLowerCase();
        const nameB = (b.employee?.fullName ?? b.employee?.employeeCode ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    const ineligible = suggestions
      .filter((s) => !s.eligible && matchesSearch(s))
      .sort((a, b) => {
        const nameA = (a.employee?.fullName ?? a.employee?.employeeCode ?? "").toLowerCase();
        const nameB = (b.employee?.fullName ?? b.employee?.employeeCode ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    const byReason = new Map<string, EmployeeSuggestion[]>();
    for (const s of ineligible) {
      const key = ineligibleReasonKey(s);
      if (!byReason.has(key)) byReason.set(key, []);
      byReason.get(key)!.push(s);
    }
    return { eligibleList: eligible, ineligibleList: ineligible, ineligibleByReason: byReason };
  }, [suggestions, searchQuery]);

  const eligibleCount = suggestions.filter((s) => s.eligible).length;
  const ineligibleCount = suggestions.filter((s) => !s.eligible).length;

  if (!machine) return null;

  function SuggestionRow({
    suggestion,
    rank,
    showApply,
  }: {
    suggestion: EmployeeSuggestion;
    rank?: number;
    showApply: boolean;
  }) {
    return (
      <div
        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        data-testid={`suggestion-row-${suggestion.employee.employeeNumber}`}
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          {rank != null && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {rank}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {suggestion.employee.fullName} ({suggestion.employee.employeeNumber})
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {suggestion.currentAssignedHours.toFixed(1)}h assigned •{" "}
              {suggestion.availableHours.toFixed(1)}h available
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge
              variant="secondary"
              className={
                suggestion.eligible
                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
              }
            >
              {suggestion.eligible
                ? "Eligible (meets line requirements)"
                : "Ineligible (missing line requirements)"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Station coverage: {suggestion.stationsPassed}/{suggestion.stationsRequired}
            </Badge>
            {typeof suggestion.skillsPassedCount === "number" &&
              typeof suggestion.requiredSkillsCount === "number" &&
              suggestion.requiredSkillsCount > 0 && (
              <Badge variant="outline" className="text-xs">
                Skills: {suggestion.skillsPassedCount}/{suggestion.requiredSkillsCount}
              </Badge>
            )}
          </div>
        </div>
        {showApply && (
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
            >
              {Math.round(suggestion.score)}%
            </Badge>
            <Button
              size="sm"
              onClick={() => handleApply(suggestion)}
              disabled={applying === suggestion.employee.employeeNumber || !suggestion.eligible}
              data-testid={`button-apply-suggestion-${suggestion.employee.employeeNumber}`}
            >
              {applying === suggestion.employee.employeeNumber ? (
                "..."
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Apply
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Auto-Suggest</DialogTitle>
              <DialogDescription>
                Suggestions for {machine.machine.stationName ?? machine.machine.machineName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gap to fill:</span>
            <span className="font-bold text-destructive">{machine.gap.toFixed(1)} hours</span>
          </div>
        </div>

        {/* Sticky header: search + tabs with counts */}
        <div className="mt-4 sticky top-0 z-10 bg-background space-y-3 pb-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or employee number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              data-testid="suggest-modal-search"
            />
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "eligible" | "ineligible")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="eligible" data-testid="tab-eligible">
                Eligible {eligibleCount}
              </TabsTrigger>
              <TabsTrigger value="ineligible" data-testid="tab-ineligible">
                Ineligible {ineligibleCount}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eligible" className="mt-2 focus-visible:outline-none">
              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1" data-testid="eligible-list">
                {loading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))}
                  </>
                ) : eligibleList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {q ? "No matching eligible employees" : "No eligible employees found"}
                    </p>
                    {!q && (
                      <p className="text-xs mt-1">Check the Ineligible tab for other staff</p>
                    )}
                  </div>
                ) : (
                  eligibleList.map((suggestion, idx) => (
                    <SuggestionRow
                      key={suggestion.employee.employeeNumber}
                      suggestion={suggestion}
                      rank={idx + 1}
                      showApply
                    />
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="ineligible" className="mt-2 focus-visible:outline-none">
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1" data-testid="ineligible-list">
                {loading ? (
                  <>
                    {[1, 2].map((i) => (
                      <div key={i} className="h-10 rounded border bg-muted/30" />
                    ))}
                  </>
                ) : ineligibleList.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    {q ? "No matching ineligible employees" : "No ineligible employees"}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground py-1">
                      {ineligibleList.length} ineligible — expand by reason below
                    </p>
                    {Array.from(ineligibleByReason.entries()).map(([reason, list]) => (
                    <Collapsible
                      key={reason}
                      open={openIneligibleReasons.has(reason)}
                      onOpenChange={(open) =>
                        setOpenIneligibleReasons((prev) => {
                          const next = new Set(prev);
                          if (open) next.add(reason);
                          else next.delete(reason);
                          return next;
                        })
                      }
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-left text-sm font-medium hover:bg-muted">
                        {openIneligibleReasons.has(reason) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {reason} ({list.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-1 ml-2 space-y-2 pl-2 border-l">
                          {list.map((suggestion) => (
                            <SuggestionRow
                              key={suggestion.employee.employeeNumber}
                              suggestion={suggestion}
                              showApply={false}
                            />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-xs text-muted-foreground mt-2 flex-shrink-0">
          Suggestions are based on availability and current workload. One-click Apply creates an
          assignment (duration = min(gap, 8h) and available hours) starting at shift start.
        </p>
      </DialogContent>
    </Dialog>
  );
}
