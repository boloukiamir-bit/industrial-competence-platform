"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AlertTriangle, Users, Shield, FileWarning, ChevronRight, ExternalLink, Calendar } from "lucide-react";
import type { PriorityItem } from "@/types/cockpit";
import { toQueryShiftType } from "@/lib/shiftType";

export type SummarySlice = {
  active_total: number;
  active_blocking: number;
  active_nonblocking: number;
};

interface PriorityFixesWidgetProps {
  items: PriorityItem[];
  onResolve: (item: PriorityItem) => void;
  /** From /api/cockpit/summary; when set, status (All clear / NO-GO,WARNING) is derived from this instead of items.length */
  summary?: SummarySlice | null;
  summaryLoading?: boolean;
  summaryError?: string | null;
  /** For all-clear state: show date/shift and CTAs (Tomorrow's Gaps, Line Overview) */
  date?: string;
  shiftType?: string;
}

const typeConfig = {
  staffing: { icon: Users, label: "Staffing", color: "text-red-600 dark:text-red-400" },
  compliance: { icon: FileWarning, label: "Compliance", color: "text-orange-600 dark:text-orange-400" },
  safety: { icon: Shield, label: "Safety", color: "text-amber-600 dark:text-amber-400" },
};

export function PriorityFixesWidget({ items, onResolve, summary, summaryLoading, summaryError, date, shiftType }: PriorityFixesWidgetProps) {
  if (items.length > 0) {
    return (
      <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/80 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">What to Fix Now</h2>
              <p className="text-xs text-muted-foreground">{items.length} priority issue{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.slice(0, 5).map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className="group flex items-center justify-between p-3 rounded-lg bg-card border hover-elevate transition-all"
                data-testid={`priority-item-${item.id}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{item.title}</span>
                      {item.severity === 'critical' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Critical</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.impact}</p>
                    {item.linkedEntity && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.linkedEntity.type === 'station' ? 'Station:' : 'Employee:'} {item.linkedEntity.name}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 shrink-0 opacity-70 group-hover:opacity-100"
                  onClick={() => onResolve(item)}
                  data-testid={`button-resolve-${item.id}`}
                >
                  Resolve
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  if (summaryLoading) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (summaryError) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-amber-700 dark:text-amber-300">Unable to load summary.</p>
        </CardContent>
      </Card>
    );
  }

  if (summary && summary.active_total > 0) {
    return (
      <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/80 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/10">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="font-medium text-red-700 dark:text-red-300">
              {summary.active_blocking} NO-GO, {summary.active_nonblocking} WARNING
            </p>
            <p className="text-sm text-muted-foreground">{summary.active_total} active decision(s)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const shiftLabel = shiftType ?? "—";
  const dateLabel = date ?? "";

  return (
    <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
      <CardContent className="flex flex-col items-center justify-center py-8">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
            <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="font-medium text-green-700 dark:text-green-300">
            All clear — no active risks for {dateLabel} {shiftLabel}.
          </p>
          <p className="text-sm text-muted-foreground mt-1">No critical issues right now</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={date && shiftType ? `/app/tomorrows-gaps?date=${date}&shift=${toQueryShiftType(shiftType as "Day" | "Evening" | "Night")}` : "/app/tomorrows-gaps"}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            data-testid="cockpit-empty-cta-tomorrows-gaps"
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            View Tomorrow&apos;s Gaps
          </Link>
          <Link
            href={date && shiftType ? `/app/line-overview?date=${date}&shift=${toQueryShiftType(shiftType as "Day" | "Evening" | "Night")}` : "/app/line-overview"}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            data-testid="cockpit-empty-cta-line-overview"
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Go to Line Overview
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
