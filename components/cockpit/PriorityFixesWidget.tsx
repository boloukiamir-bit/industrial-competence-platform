"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <div className="cockpit-card-secondary overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <h2 className="cockpit-title">Interventions</h2>
        </div>
        <div className="divide-y divide-border">
          {items.slice(0, 5).map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between px-3 py-2",
                  item.severity === "critical" && "border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]"
                )}
                data-testid={`priority-item-${item.id}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="cockpit-body font-medium truncate">{item.title}</span>
                    </div>
                    <p className="cockpit-label mt-0.5 line-clamp-1">{item.impact}</p>
                    {item.linkedEntity && (
                      <p className="cockpit-label mt-0.5">
                        {item.linkedEntity.type === "station" ? "Station:" : "Employee:"} {item.linkedEntity.name}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[13px] shrink-0"
                  onClick={() => onResolve(item)}
                  data-testid={`button-resolve-${item.id}`}
                >
                  Resolve
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (summaryLoading) {
    return (
      <div className="cockpit-card-secondary flex items-center justify-center py-6">
        <span className="cockpit-body text-muted-foreground/70">—</span>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="cockpit-card-secondary flex items-center justify-center py-6 border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]">
        <p className="cockpit-body cockpit-status-at-risk">Unable to load.</p>
      </div>
    );
  }

  if (summary && summary.active_total > 0) {
    return (
      <div className="cockpit-card-secondary overflow-hidden border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]">
        <div className="flex flex-col items-center justify-center py-5 px-4">
          <p className="cockpit-body cockpit-status-blocking font-medium">
            {summary.active_blocking} blocking, {summary.active_nonblocking} at risk
          </p>
        </div>
      </div>
    );
  }

  const shiftLabel = shiftType ?? "—";
  const dateLabel = date ?? "";

  return (
    <div className="cockpit-card-secondary overflow-hidden border-l-[3px] border-l-[hsl(var(--ds-status-ok-text))]">
      <div className="flex flex-col items-center justify-center py-5 px-4">
        <p className="cockpit-body cockpit-status-ok font-medium">Clear · {dateLabel} {shiftLabel}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <Link
            href={date && shiftType ? `/app/tomorrows-gaps?date=${date}&shift=${toQueryShiftType(shiftType as "Day" | "Evening" | "Night")}` : "/app/tomorrows-gaps"}
            className="inline-flex items-center justify-center h-8 rounded border border-input bg-background px-3 cockpit-body hover:bg-accent"
            data-testid="cockpit-empty-cta-tomorrows-gaps"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Tomorrow&apos;s Gaps
          </Link>
          <Link
            href={date && shiftType ? `/app/line-overview?date=${date}&shift=${toQueryShiftType(shiftType as "Day" | "Evening" | "Night")}` : "/app/line-overview"}
            className="inline-flex items-center justify-center h-8 rounded border border-input bg-background px-3 cockpit-body hover:bg-accent"
            data-testid="cockpit-empty-cta-line-overview"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Line Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
