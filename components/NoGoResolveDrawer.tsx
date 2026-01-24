"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logExecutionDecision } from "@/lib/executionDecisions";
import { useToast } from "@/hooks/use-toast";
import type { ShiftType } from "@/types/lineOverview";

export interface ShiftAssignmentRow {
  id: string;
  station_id: string;
  employee_id: string | null;
  shift_id: string;
  stations: { name: string }[] | null;
}

interface NoGoResolveDrawerProps {
  open: boolean;
  onClose: (wasResolved?: boolean) => void;
  shiftAssignmentId: string | null;
  shiftAssignment: ShiftAssignmentRow | null;
  date: string;
  shiftType: ShiftType;
  line: string;
}

const isUuid = (v: string | null | undefined) =>
  !!v &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export function NoGoResolveDrawer({
  open,
  onClose,
  shiftAssignmentId,
  shiftAssignment,
  date,
  shiftType,
  line,
}: NoGoResolveDrawerProps) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [alreadyResolved, setAlreadyResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!shiftAssignment || !shiftAssignmentId) return null;

  const handleResolve = async () => {
    if (!isUuid(shiftAssignmentId)) {
      setError("Cannot resolve: missing real shift_assignment id (not persisted yet).");
      return;
    }

    setSaving(true);
    setAlreadyResolved(false);
    setError(null);
    try {
      // Build root_cause from shift assignment data
      const root_cause = {
        type: "competence", // Default, can be enhanced later
        shift_id: shiftAssignment.shift_id,
        station_id: shiftAssignment.station_id,
        employee_id: shiftAssignment.employee_id,
        date,
      };

      const actions = {
        recommended: ["swap", "assign", "call_in", "escalate"],
        selected: ["swap"], // Default selection
      };

      const res = await logExecutionDecision({
        decision_type: "resolve_no_go",
        target_type: "shift_assignment",
        target_id: shiftAssignmentId,
        reason: note,
        root_cause,
        actions,
      });

      console.log("Resolve result:", res);

      if (res.status !== "created" && res.status !== "already_resolved") {
        throw new Error("Unexpected resolve result");
      }

      if (res.status === "already_resolved") {
        setAlreadyResolved(true);
        toast({ 
          title: "Already resolved", 
          description: "This NO-GO has already been resolved",
          variant: "default"
        });
        // Close drawer after a short delay
        setTimeout(() => {
          handleClose(false);
        }, 2000);
      } else {
        toast({ title: "Resolved", description: "NO-GO decision has been logged" });
        handleClose(true); // Signal that it was resolved
      }
    } catch (error) {
      console.error("Failed to log execution decision:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve NO-GO",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset state when drawer closes
  const handleClose = (wasResolved = false) => {
    setAlreadyResolved(false);
    setNote("");
    setError(null);
    onClose(wasResolved);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Resolve NO-GO</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium">
              {line} • {shiftType}
            </Label>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Station: {shiftAssignment.stations?.[0]?.name || "Unknown"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Reason / Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter resolution note..."
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                {error}
              </p>
            </div>
          )}

          {alreadyResolved && (
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                Already resolved
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                This NO-GO has already been resolved. The drawer will close shortly.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              onClick={handleResolve}
              disabled={!isUuid(shiftAssignmentId) || alreadyResolved || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : alreadyResolved ? "Already Resolved" : "Resolve"}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
