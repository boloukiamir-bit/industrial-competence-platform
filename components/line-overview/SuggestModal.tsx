"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, User, Clock, Check } from "lucide-react";
import type { MachineWithData, ShiftType, EmployeeSuggestion } from "@/types/lineOverview";
import { getSuggestions, createAssignment } from "@/services/lineOverview";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    if (open && machine) {
      loadSuggestions();
    }
  }, [open, machine, planDate, shiftType]);

  const loadSuggestions = async () => {
    if (!machine) return;

    setLoading(true);
    try {
      const results = await getSuggestions(
        planDate,
        shiftType,
        machine.machine.machineCode,
        machine.gap
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

    setApplying(suggestion.employee.employeeCode);

    const gap = machine.gap;
    const segmentHours = gap >= 4 ? 4 : gap;
    const shiftStart = shiftTimes[shiftType].start;

    const startHour = parseInt(shiftStart.split(":")[0], 10);
    const endHour = startHour + Math.ceil(segmentHours);
    const endTime = `${endHour.toString().padStart(2, "0")}:00`;

    try {
      const result = await createAssignment(
        planDate,
        shiftType,
        machine.machine.machineCode,
        suggestion.employee.employeeCode,
        shiftStart,
        endTime
      );

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
      toast({ title: "Error creating assignment", variant: "destructive" });
    } finally {
      setApplying(null);
    }
  };

  if (!machine) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Auto-Suggest</DialogTitle>
              <DialogDescription>
                Top 3 recommendations for {machine.machine.machineName}
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

        <div className="mt-4 space-y-3">
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
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No available employees found</p>
              <p className="text-xs mt-1">All employees are either absent or fully booked</p>
            </div>
          ) : (
            suggestions.map((suggestion, idx) => (
              <div
                key={suggestion.employee.employeeCode}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{suggestion.employee.fullName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {suggestion.currentAssignedHours.toFixed(1)}h assigned •{" "}
                      {suggestion.availableHours.toFixed(1)}h available
                    </span>
                  </div>
                </div>
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
                    disabled={applying === suggestion.employee.employeeCode}
                    data-testid={`button-apply-suggestion-${suggestion.employee.employeeCode}`}
                  >
                    {applying === suggestion.employee.employeeCode ? (
                      "..."
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Apply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Suggestions are based on availability and current workload. One-click Apply creates a{" "}
          {Math.min(machine.gap, 4)}-hour assignment starting at shift start.
        </p>
      </DialogContent>
    </Dialog>
  );
}
