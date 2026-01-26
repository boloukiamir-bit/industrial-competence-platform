"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { getIssueInbox } from "@/services/issues";
import type { IssueInboxItem } from "@/types/issues";

export function IssueInboxSection() {
  const [items, setItems] = useState<IssueInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IssueInboxItem | null>(null);
  const [resolveStatus, setResolveStatus] = useState<"resolved" | "snoozed">("resolved");
  const [resolveNote, setResolveNote] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const data = await getIssueInbox();
        setItems(data);
      } catch (err) {
        console.error(err);
        setError("Could not load issues.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleResolve = async () => {
    if (!selectedItem || selectedItem.source !== "hr") return;

    setSaving(true);
    try {
      const response = await fetch("/api/hr/tasks/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskSource: selectedItem.native_ref.task_source,
          taskId: selectedItem.native_ref.task_id,
          status: resolveStatus,
          note: resolveNote || null,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to resolve task");
      }

      // Refresh items
      const data = await getIssueInbox();
      setItems(data);
      setResolveDialogOpen(false);
      setSelectedItem(null);
      setResolveNote("");
    } catch (err) {
      console.error("Failed to resolve task:", err);
      alert(err instanceof Error ? err.message : "Failed to resolve task");
    } finally {
      setSaving(false);
    }
  };

  const handleViewCockpit = async (item: IssueInboxItem) => {
    if (item.source !== "cockpit" || !item.native_ref.shift_assignment_id) {
      router.push("/app/cockpit");
      return;
    }

    // Try to extract date from subtitle if available (format: "2026-01-26 Day")
    // Otherwise navigate to base cockpit page
    if (item.subtitle) {
      const parts = item.subtitle.split(" ");
      if (parts.length >= 2) {
        const date = parts[0];
        const shiftType = parts[1].toLowerCase();
        router.push(`/app/cockpit?date=${date}&shift=${shiftType}&line=all`);
        return;
      }
    }

    // Fallback: navigate to base cockpit page
    router.push("/app/cockpit");
  };

  const getSeverityBadge = (severity: "P0" | "P1" | "P2") => {
    const config = {
      P0: { label: "P0", className: "hr-task-row__status--danger" },
      P1: { label: "P1", className: "hr-task-row__status--warn" },
      P2: { label: "P2", className: "hr-task-row__status--ok" },
    };
    return config[severity];
  };

  const getIssueTypeLabel = (type: IssueInboxItem["issue_type"]) => {
    const labels = {
      no_go: "NO-GO",
      warning: "Warning",
      medical_expiring: "Medical",
      cert_expiring: "Certificate",
    };
    return labels[type];
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading issues...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-destructive py-8">
        <AlertCircle className="h-4 w-4 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="hr-task-empty">No issues found.</p>;
  }

  return (
    <>
      <div className="hr-task-list">
        {items.map((item) => {
          const severityBadge = getSeverityBadge(item.severity);
          const dueDate = item.due_date
            ? new Date(item.due_date).toLocaleDateString("sv-SE")
            : null;

          return (
            <div key={item.id} className="hr-task-row" data-testid={`issue-item-${item.id}`}>
              <div className="hr-task-row__main">
                <div className="flex items-center gap-2">
                  <h3 className="hr-task-row__title">{item.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    ({getIssueTypeLabel(item.issue_type)})
                  </span>
                </div>
                <p className="hr-task-row__subtitle">
                  {item.subtitle || "—"}
                  {item.source === "cockpit" && dueDate && ` · ${dueDate}`}
                </p>
                {item.resolution_status && (
                  <div className="flex items-center gap-1 mt-1">
                    {item.resolution_status === "resolved" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <Clock className="h-3 w-3 text-yellow-600" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.resolution_status === "resolved" ? "Resolved" : "Snoozed"}
                    </span>
                  </div>
                )}
              </div>
              <div className="hr-task-row__meta">
                {dueDate && (
                  <span className="hr-task-row__date">{dueDate}</span>
                )}
                <span className={`hr-task-row__status ${severityBadge.className}`}>
                  {severityBadge.label}
                </span>
                <div className="flex gap-2 mt-2">
                  {item.source === "hr" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedItem(item);
                        setResolveStatus("resolved");
                        setResolveNote("");
                        setResolveDialogOpen(true);
                      }}
                    >
                      Resolve
                    </Button>
                  )}
                  {item.source === "cockpit" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewCockpit(item)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Issue</DialogTitle>
            <DialogDescription>
              {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="resolve-status">Status</Label>
              <Select
                value={resolveStatus}
                onValueChange={(v) => setResolveStatus(v as "resolved" | "snoozed")}
              >
                <SelectTrigger id="resolve-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="snoozed">Snoozed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="resolve-note">Note (optional)</Label>
              <Textarea
                id="resolve-note"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Add a note about this resolution..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
