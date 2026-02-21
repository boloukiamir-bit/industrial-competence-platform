"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  X, 
  Check, 
  UserPlus, 
  Calendar, 
  Clock, 
  User, 
  MapPin,
  AlertCircle,
  Activity
} from "lucide-react";
import type { Action, ActivityLogEntry } from "@/types/cockpit";

interface ActionDrawerProps {
  action: Action | null;
  open: boolean;
  onClose: () => void;
  onMarkDone: (actionId: string) => void;
  onReassign: (actionId: string, newOwnerId: string, newOwnerName: string) => void;
  onChangeDueDate: (actionId: string, newDate: string) => void;
  activityLog: ActivityLogEntry[];
  availableOwners: { id: string; name: string }[];
}

const severityStyles = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const domainLabels = {
  ops: "Operations",
  people: "People",
  safety: "Safety",
};

export function ActionDrawer({
  action,
  open,
  onClose,
  onMarkDone,
  onReassign,
  onChangeDueDate,
  activityLog,
  availableOwners,
}: ActionDrawerProps) {
  const [showReassign, setShowReassign] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  if (!action) return null;

  const handleReassign = () => {
    const owner = availableOwners.find(o => o.id === newOwnerId);
    if (owner) {
      onReassign(action.id, owner.id, owner.name);
      setShowReassign(false);
      setNewOwnerId("");
    }
  };

  const handleChangeDueDate = () => {
    if (newDueDate) {
      onChangeDueDate(action.id, newDueDate);
      setShowDatePicker(false);
      setNewDueDate("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight pr-8">
                {action.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {domainLabels[action.domain]}
                </Badge>
                <Badge className={`text-xs ${severityStyles[action.severity]}`}>
                  {action.severity}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {action.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {action.description && (
            <p className="text-sm text-muted-foreground">{action.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Owner
              </Label>
              <p className="text-sm font-medium">{action.ownerName || "Unassigned"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Due Date
              </Label>
              <p className="text-sm font-medium">
                {action.dueDate ? format(new Date(action.dueDate), "MMM d, yyyy") : "No due date"}
              </p>
            </div>
          </div>

          {(action.relatedEmployeeName || action.relatedStationName) && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Linked Entity
              </Label>
              {action.relatedEmployeeName && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Employee:</span>{" "}
                  <span className="font-medium">{action.relatedEmployeeName}</span>
                </p>
              )}
              {action.relatedStationName && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Station:</span>{" "}
                  <span className="font-medium">{action.relatedStationName}</span>
                </p>
              )}
            </div>
          )}

          {action.impact && (
            <div className="p-3 rounded-sm bg-orange-50 border border-orange-200">
              <Label className="text-xs text-orange-600 flex items-center gap-1 mb-1">
                <AlertCircle className="h-3 w-3" /> Impact
              </Label>
              <p className="text-sm">{action.impact}</p>
            </div>
          )}

          {showReassign && (
            <div className="p-3 rounded-lg border space-y-3">
              <Label className="text-sm">Reassign to</Label>
              <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                <SelectTrigger data-testid="select-new-owner">
                  <SelectValue placeholder="Select new owner" />
                </SelectTrigger>
                <SelectContent>
                  {availableOwners.map(owner => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReassign} disabled={!newOwnerId} data-testid="button-confirm-reassign">
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReassign(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {showDatePicker && (
            <div className="p-3 rounded-lg border space-y-3">
              <Label className="text-sm">New due date</Label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                data-testid="input-new-due-date"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleChangeDueDate} disabled={!newDueDate} data-testid="button-confirm-due-date">
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" /> Activity Log
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {activityLog.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No activity yet</p>
              ) : (
                activityLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-sm">
                    <Clock className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-muted-foreground">{entry.description}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                        {entry.userName && ` by ${entry.userName}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t">
          <Button
            onClick={() => onMarkDone(action.id)}
            className="flex-1"
            data-testid="button-action-mark-done"
          >
            <Check className="h-4 w-4 mr-2" />
            Mark Done
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowReassign(!showReassign)}
            data-testid="button-action-reassign"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowDatePicker(!showDatePicker)}
            data-testid="button-action-change-due"
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
