"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Zap, Users } from "lucide-react";
import type { Action } from "@/types/cockpit";

export type SummaryTopActions = {
  top_actions: Array<{ action: string; count: number }>;
  active_total: number;
};

interface ActionsWidgetProps {
  actions: Action[];
  onMarkDone: (actionId: string) => void;
  onActionClick?: (action: Action) => void;
  /** From /api/cockpit/summary; when set, Top 5 Actions and status are driven by this */
  summary?: SummaryTopActions | null;
  summaryLoading?: boolean;
  summaryError?: string | null;
}


function formatDueDate(dueDate?: string): string {
  if (!dueDate) return "";
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `${diffDays}d`;
}

function humanActionLabel(s: string): string {
  const m: Record<string, string> = {
    assign: "Assign",
    call_in: "Call in",
    escalate: "Escalate",
    fix_data: "Fix data",
    swap: "Swap",
  };
  return m[s] || s.replace(/_/g, " ");
}

export function ActionsWidget({ actions, onMarkDone, onActionClick, summary, summaryLoading, summaryError }: ActionsWidgetProps) {
  const [completing, setCompleting] = useState<string | null>(null);

  const handleMarkDone = async (actionId: string) => {
    setCompleting(actionId);
    await onMarkDone(actionId);
    setCompleting(null);
  };

  const widgetHeader = (
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="cockpit-title">Top 5 Actions</h3>
    </div>
  );

  if (summary !== undefined) {
    if (summaryLoading) {
      return (
        <div className="cockpit-card-secondary overflow-hidden h-full">
          {widgetHeader}
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        </div>
      );
    }
    if (summaryError) {
      return (
        <div className="cockpit-card-secondary overflow-hidden h-full">
          {widgetHeader}
          <div className="py-6 text-center cockpit-body cockpit-status-at-risk px-4">Unable to load summary.</div>
        </div>
      );
    }
    if (summary && summary.active_total === 0) {
      return (
        <div className="cockpit-card-secondary overflow-hidden h-full">
          {widgetHeader}
          <div className="text-center py-6 cockpit-body text-muted-foreground px-4">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 cockpit-status-ok" />
            <p>All caught up. No open actions.</p>
          </div>
        </div>
      );
    }
    if (summary && summary.top_actions.length === 0) {
      return (
        <div className="cockpit-card-secondary overflow-hidden h-full">
          {widgetHeader}
          <div className="text-center py-6 cockpit-body text-muted-foreground px-4">No actions logged yet.</div>
        </div>
      );
    }
    if (summary && summary.top_actions.length > 0) {
      return (
        <div className="cockpit-card-secondary overflow-hidden h-full">
          {widgetHeader}
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {summary.top_actions.map(({ action, count }) => (
              <span key={action} className="cockpit-body cockpit-num px-2 py-0.5 rounded border border-border">
                {humanActionLabel(action)} ×{count}
              </span>
            ))}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="cockpit-card-secondary overflow-hidden h-full">
      {widgetHeader}
      <div className="divide-y divide-border">
        {actions.length === 0 ? (
          <div className="text-center py-6 cockpit-body text-muted-foreground px-4">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 cockpit-status-ok" />
            <p>All caught up. No open actions.</p>
          </div>
        ) : (
          actions.slice(0, 5).map((action) => (
            <div
              key={action.id}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-[hsl(var(--ds-table-row-hover))] cursor-pointer"
              onClick={() => onActionClick?.(action)}
              data-testid={`action-item-${action.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="cockpit-label">{action.domain}</span>
                  {action.severity === "critical" && (
                    <span className="cockpit-label cockpit-status-blocking">Blocking</span>
                  )}
                </div>
                <p className="cockpit-body font-medium truncate" title={action.title}>
                  {action.title}
                </p>
                <div className="flex items-center gap-3 mt-0.5 cockpit-label">
                  {action.ownerName && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {action.ownerName}
                    </span>
                  )}
                  {action.dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDueDate(action.dueDate)}
                    </span>
                  )}
                </div>
                {action.impact && (
                  <p className="cockpit-label cockpit-status-at-risk mt-0.5 truncate">Impact: {action.impact}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkDone(action.id);
                }}
                disabled={completing === action.id}
                data-testid={`button-complete-${action.id}`}
              >
                {completing === action.id ? (
                  <span className="animate-spin">...</span>
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 cockpit-status-ok" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
