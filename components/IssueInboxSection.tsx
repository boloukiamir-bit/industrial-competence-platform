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
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { getIssueInbox } from "@/services/issues";
import type { IssueInboxItem } from "@/types/issues";

export function IssueInboxSection() {
  const [items, setItems] = useState<IssueInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IssueInboxItem | null>(null);
  const [resolveStatus, setResolveStatus] = useState<"resolved" | "snoozed">("resolved");
  const [resolveNote, setResolveNote] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getIssueInbox(showResolved);
        setItems(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Could not load issues.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showResolved]);

  const handleResolve = async () => {
    if (!selectedItem) return;

    setSaving(true);
    try {
      let response;
      if (selectedItem.source === "hr") {
        // Use existing HR resolve endpoint
        response = await fetch("/api/hr/tasks/resolve", {
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
      } else if (selectedItem.source === "cockpit") {
        // Use new unified resolve endpoint
        response = await fetch("/api/issues/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "cockpit",
            native_ref: selectedItem.native_ref,
            note: resolveNote || null,
          }),
          credentials: "include",
        });
      } else {
        throw new Error("Unknown source type");
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to resolve issue");
      }

      // Refresh items
      const data = await getIssueInbox(showResolved);
      setItems(data);
      setResolveDialogOpen(false);
      setSelectedItem(null);
      setResolveNote("");
    } catch (err) {
      console.error("Failed to resolve issue:", err);
      alert(err instanceof Error ? err.message : "Failed to resolve issue");
    } finally {
      setSaving(false);
    }
  };

  const handleViewCockpit = (item: IssueInboxItem) => {
    const id = item.native_ref?.shift_assignment_id;
    if (id) {
      router.push(`/app/cockpit?shift_assignment_id=${id}`);
    } else {
      router.push("/app/cockpit");
    }
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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="show-resolved" className="text-sm font-normal cursor-pointer">
            Show resolved
          </Label>
          <Switch
            id="show-resolved"
            checked={showResolved}
            onCheckedChange={setShowResolved}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading issues...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-sm text-destructive py-8">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        <p className="hr-task-empty">No issues found.</p>
      ) : (
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
                  {item.source === "hr" && !item.resolution_status && (
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
                  {item.source === "cockpit" && !item.resolution_status && (
                    <>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewCockpit(item)}
                      >
                        Open in Cockpit
                      </Button>
                    </>
                  )}
                  {item.source === "cockpit" && item.resolution_status && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewCockpit(item)}
                    >
                      Open in Cockpit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Issue</DialogTitle>
            <DialogDescription>
              {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedItem?.source === "hr" && (
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
            )}
            {selectedItem?.source === "cockpit" && (
              <div className="text-sm text-muted-foreground">
                Status: Resolved
              </div>
            )}
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
