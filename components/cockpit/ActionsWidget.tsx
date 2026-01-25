"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, Zap, Users, Shield, Wrench } from "lucide-react";
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

const domainIcons: Record<string, React.ReactNode> = {
  ops: <Wrench className="h-3.5 w-3.5" />,
  people: <Users className="h-3.5 w-3.5" />,
  safety: <Shield className="h-3.5 w-3.5" />,
};

const domainColors: Record<string, string> = {
  ops: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  people: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  safety: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const severityColors: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-gray-400 text-white",
};

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

  if (summary !== undefined) {
    if (summaryLoading) {
      return (
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              Top 5 Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </CardContent>
        </Card>
      );
    }
    if (summaryError) {
      return (
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              Top 5 Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center text-sm text-amber-700 dark:text-amber-300">
            Unable to load summary.
          </CardContent>
        </Card>
      );
    }
    if (summary && summary.active_total === 0) {
      return (
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              Top 5 Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p className="text-sm">All caught up! No open actions.</p>
          </CardContent>
        </Card>
      );
    }
    if (summary && summary.top_actions.length === 0) {
      return (
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              Top 5 Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No actions logged yet.</p>
          </CardContent>
        </Card>
      );
    }
    if (summary && summary.top_actions.length > 0) {
      return (
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              Top 5 Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {summary.top_actions.map(({ action, count }) => (
                <Badge key={action} variant="secondary" className="text-xs">
                  {humanActionLabel(action)} <span className="text-muted-foreground ml-0.5">×{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Zap className="h-4 w-4 text-amber-500" />
          Top 5 Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p className="text-sm">All caught up! No open actions.</p>
          </div>
        ) : (
          actions.slice(0, 5).map((action) => (
            <div
              key={action.id}
              className="group flex items-start gap-3 p-3 rounded-lg border border-border/50 hover-elevate cursor-pointer transition-all"
              onClick={() => onActionClick?.(action)}
              data-testid={`action-item-${action.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${domainColors[action.domain]}`}>
                    {domainIcons[action.domain]}
                    <span className="ml-1 capitalize">{action.domain}</span>
                  </Badge>
                  <Badge className={`text-xs px-1.5 py-0 ${severityColors[action.severity]}`}>
                    {action.severity === "critical" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                    {action.severity}
                  </Badge>
                </div>
                <p className="font-medium text-sm truncate" title={action.title}>
                  {action.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                    Impact: {action.impact}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
