"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Save } from "lucide-react";
import type { MachineWithData, ShiftType } from "@/types/lineOverview";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";

interface DemandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: MachineWithData | null;
  planDate: string;
  shiftType: ShiftType;
  onDemandChange: () => void;
}

export function DemandModal({
  open,
  onOpenChange,
  machine,
  planDate,
  shiftType,
  onDemandChange,
}: DemandModalProps) {
  const { toast } = useToast();
  const [requiredHours, setRequiredHours] = useState("8");
  const [priority, setPriority] = useState("1");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRequiredHours("8");
      setPriority("1");
      setComment("");
    }
  }, [open]);

  if (!machine) return null;

  const handleSave = async () => {
    const hours = parseFloat(requiredHours);
    if (isNaN(hours) || hours <= 0) {
      toast({ title: "Please enter valid hours (> 0)", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/line-overview/demand", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          stationId: machine.machine.stationId ?? machine.machine.id,
          machineCode: machine.machine.machineCode,
          date: planDate,
          shift: shiftType.toLowerCase(),
          requiredHours: hours,
          priority: parseInt(priority, 10),
          comment: comment || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: number;
        updated?: number;
        message?: string;
        error?: string;
        step?: string;
        details?: unknown;
      };

      if (!response.ok || data?.ok === false) {
        const detailsStr = data?.details != null ? JSON.stringify(data.details) : "";
        const parts = [
          response.status != null && `Status: ${response.status}`,
          data?.step && `Step: ${data.step}`,
          data?.error ?? "Failed to save demand",
          detailsStr && `Details: ${detailsStr}`,
        ].filter(Boolean);
        toast({
          title: "Save demand failed",
          description: parts.join(". "),
          variant: "destructive",
        });
        return;
      }

      const created = data?.created ?? 0;
      const updated = data?.updated ?? 0;
      const message = data?.message;
      if (message === "already_exists") {
        toast({ title: "Demand already exists", description: "No changes made." });
      } else if (created > 0 || updated > 0) {
        toast({
          title: "Demand saved",
          description: `Created: ${created}, updated: ${updated}.`,
        });
      } else {
        toast({ title: "Demand created successfully" });
      }
      onDemandChange();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Error creating demand",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Add Demand</DialogTitle>
              <DialogDescription>
                {machine.machine.machineName} • {planDate} • {shiftType}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="hours">Required Hours</Label>
            <Input
              id="hours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={requiredHours}
              onChange={(e) => setRequiredHours(e.target.value)}
              data-testid="input-required-hours"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 - High</SelectItem>
                <SelectItem value="2">2 - Medium</SelectItem>
                <SelectItem value="3">3 - Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add any notes about this demand..."
              className="resize-none"
              rows={3}
              data-testid="input-comment"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-demand">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Demand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
