"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiBucket = "action_required" | "expiring_soon" | "valid" | "waived";

export type KpiCardState = {
  count: number;
  employeeCount: number;
  employeePct: number;
  totalEmployees: number;
};

const CARDS: Array<{
  key: KpiBucket;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconClass: string;
}> = [
  {
    key: "action_required",
    label: "Action required",
    icon: AlertTriangle,
    bgClass: "bg-red-50 dark:bg-red-950/30",
    borderClass: "border-red-200 dark:border-red-900/50",
    textClass: "text-red-800 dark:text-red-200",
    iconClass: "text-red-600 dark:text-red-400",
  },
  {
    key: "expiring_soon",
    label: "Expiring soon (≤30 days)",
    icon: Clock,
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-900/50",
    textClass: "text-amber-800 dark:text-amber-200",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "valid",
    label: "Compliant",
    icon: CheckCircle,
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    borderClass: "border-emerald-200 dark:border-emerald-900/50",
    textClass: "text-emerald-800 dark:text-emerald-200",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "waived",
    label: "Exempt / Waived",
    icon: MinusCircle,
    bgClass: "bg-slate-100 dark:bg-slate-800/50",
    borderClass: "border-slate-200 dark:border-slate-700",
    textClass: "text-slate-700 dark:text-slate-300",
    iconClass: "text-slate-500 dark:text-slate-400",
  },
];

type ComplianceKpiCardsProps = {
  stats: Record<KpiBucket, KpiCardState>;
  activeBucket: KpiBucket | null;
  onBucketClick: (bucket: KpiBucket) => void;
  loading?: boolean;
};

export function ComplianceKpiCards({
  stats,
  activeBucket,
  onBucketClick,
  loading = false,
}: ComplianceKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {CARDS.map(({ key, label, icon: Icon, bgClass, borderClass, textClass, iconClass }) => {
        const s = stats[key];
        const isActive = activeBucket === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onBucketClick(key)}
            className={cn(
              "text-left rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              bgClass,
              borderClass,
              isActive && "ring-2 ring-offset-2 ring-primary"
            )}
          >
            <Card className={cn("border-0 shadow-none bg-transparent", loading && "animate-pulse")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-xs font-medium uppercase tracking-wide", textClass)}>
                    {label}
                  </span>
                  <Icon className={cn("h-5 w-5 shrink-0", iconClass)} aria-hidden />
                </div>
                {loading ? (
                  <div className="h-8 w-16 bg-current/20 rounded mt-2" />
                ) : (
                  <>
                    <p className={cn("mt-1 text-2xl font-bold tabular-nums", textClass)}>
                      {s?.count ?? 0}
                    </p>
                    <p className={cn("text-xs mt-0.5", textClass)}>
                      {s?.employeeCount ?? 0} employees
                      {typeof s?.employeePct === "number" && s.totalEmployees > 0
                        ? ` (${s.employeePct.toFixed(0)}%)`
                        : ""}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
