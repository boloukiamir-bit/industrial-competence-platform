"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/coreFetch";
import { useToast } from "@/hooks/use-toast";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type CreateActionPrefill = {
  employee_id: string;
  employee_name: string;
  requirement_name: string;
  requirement_code: string;
  title: string;
};

type CreateActionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: CreateActionPrefill | null;
  onCreated: () => void;
};

export function CreateActionModal({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: CreateActionModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState(() => todayPlus(14));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && prefill) {
      setTitle(prefill.title);
      setAssignedTo("");
      setDueDate(todayPlus(14));
      setNotes("");
    }
  }, [open, prefill?.title]);

  const handleCreate = async () => {
    if (!prefill || !title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetchJson<{ ok?: boolean; action?: { id: string }; error?: string }>(
        "/api/compliance/actions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: notes.trim() || "",
            employee_id: prefill.employee_id,
            compliance_code: prefill.requirement_code,
            assigned_to_user_id: assignedTo.trim() || null,
            due_date: dueDate || null,
          }),
        }
      );
      if (!res.ok || !res.data?.ok) {
        toast({
          title: "Failed to create action",
          description: res.ok ? res.data?.error ?? "Unknown error" : res.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Action created", description: "Compliance action has been recorded." });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Failed to create action",
        description: err instanceof Error ? err.message : "Unexpected error",
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
          <DialogTitle>Create action</DialogTitle>
          <DialogDescription>
            {prefill
              ? `${prefill.employee_name} · ${prefill.requirement_name} — compliance gap`
              : "Record a compliance gap action."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-action-title">Title</Label>
            <Input
              id="create-action-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Employee – Requirement – Compliance gap"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-action-assigned">Assigned to (email or name)</Label>
            <Input
              id="create-action-assigned"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-action-due">Due date</Label>
            <Input
              id="create-action-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-action-notes">Notes</Label>
            <Textarea
              id="create-action-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              "Create action"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
