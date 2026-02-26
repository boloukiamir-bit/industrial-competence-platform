"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PrioritySummary } from "@/types/domain";
import { getSeverityFromSignals, severityToPillClassName, type SeveritySignals } from "@/lib/ui/severity";

export type PriorityStripProps = {
  summary: PrioritySummary | null;
  loading: boolean;
  error: boolean;
};

const PILLS: Array<{
  key: keyof PrioritySummary;
  label: string;
  href: string;
  severitySignals: SeveritySignals;
}> = [
  { key: "overdueActions", label: "Overdue", href: "/app/hr/inbox?tab=actions&filter=overdue", severitySignals: { overdue: true } },
  { key: "unassignedActions", label: "Unassigned", href: "/app/hr/inbox?tab=actions&filter=open", severitySignals: { unassigned: true } },
  { key: "legalStops", label: "LEGAL STOP", href: "/app/hr/inbox?tab=governance", severitySignals: { legitimacy: "LEGAL_STOP" } },
  { key: "noGoOrWarnings", label: "NO_GO/WARNING", href: "/app/hr/inbox?tab=governance", severitySignals: { readiness: "NO_GO" } },
];

export function PriorityStrip({ summary, loading, error }: PriorityStripProps) {
  const router = useRouter();

  const counts = summary
    ? {
        overdueActions: summary.overdueActions,
        unassignedActions: summary.unassignedActions,
        legalStops: summary.legalStops,
        noGoOrWarnings: summary.noGoOrWarnings,
      }
    : {
        overdueActions: 0,
        unassignedActions: 0,
        legalStops: 0,
        noGoOrWarnings: 0,
      };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {PILLS.map(({ key, label, href, severitySignals }) => {
          const count = counts[key];
          const hasCount = count > 0;
          const level = getSeverityFromSignals(hasCount ? severitySignals : {});
          const pillClass = severityToPillClassName(level);
          return (
            <button
              key={key}
              type="button"
              onClick={() => router.push(href)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/60",
                pillClass
              )}
            >
              <span>{label}</span>
              {loading ? (
                <span className="h-4 w-5 animate-pulse rounded bg-muted" />
              ) : (
                <span className="tabular-nums">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-muted-foreground">Could not load priority counts.</p>
      )}
    </div>
  );
}
