"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RowStatus = "action_required" | "expiring" | "ok";

export type ComplianceTableRow = {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  line: string | null;
  department: string | null;
  missing: number;
  expiring: number;
  overdue: number;
  waived: number;
  rowStatus: RowStatus;
};

type ComplianceTableProps = {
  rows: ComplianceTableRow[];
  onReview: (employeeId: string, name: string, number: string) => void;
  loading?: boolean;
};

function StatusPill({ rowStatus }: { rowStatus: RowStatus }) {
  const config =
    rowStatus === "action_required"
      ? { label: "Action required", className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" }
      : rowStatus === "expiring"
        ? { label: "Expiring", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" }
        : { label: "OK", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

export function ComplianceTable({ rows, onReview, loading = false }: ComplianceTableProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium">Employee</th>
                <th className="text-left py-2 px-3 font-medium">Line / Team</th>
                <th className="text-right py-2 px-3 font-medium">Missing</th>
                <th className="text-right py-2 px-3 font-medium">Expiring</th>
                <th className="text-right py-2 px-3 font-medium">Overdue</th>
                <th className="text-left py-2 px-3 font-medium">Status</th>
                <th className="w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-border/50 animate-pulse">
                  <td className="py-2 px-3"><div className="h-4 bg-muted rounded w-32" /></td>
                  <td className="py-2 px-3"><div className="h-4 bg-muted rounded w-20" /></td>
                  <td className="py-2 px-3 text-right"><div className="h-4 bg-muted rounded w-6 ml-auto" /></td>
                  <td className="py-2 px-3 text-right"><div className="h-4 bg-muted rounded w-6 ml-auto" /></td>
                  <td className="py-2 px-3 text-right"><div className="h-4 bg-muted rounded w-6 ml-auto" /></td>
                  <td className="py-2 px-3"><div className="h-5 bg-muted rounded-full w-24" /></td>
                  <td className="py-2 px-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
        No employees match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-3 font-medium">Employee</th>
              <th className="text-left py-2 px-3 font-medium">Line / Team</th>
              <th className="text-right py-2 px-3 font-medium w-16">Missing</th>
              <th className="text-right py-2 px-3 font-medium w-16">Expiring</th>
              <th className="text-right py-2 px-3 font-medium w-16">Overdue</th>
              <th className="text-left py-2 px-3 font-medium w-32">Status</th>
              <th className="w-[90px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.employee_id}
                className={cn(
                  "border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/50",
                  idx % 2 === 1 && "bg-muted/20"
                )}
                onClick={() => onReview(row.employee_id, row.employee_name, row.employee_number)}
              >
                <td className="py-2 px-3">
                  <div>
                    <p className="font-medium truncate max-w-[200px]">{row.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{row.employee_number || "—"}</p>
                  </div>
                </td>
                <td className="py-2 px-3 text-muted-foreground text-xs">
                  {[row.line, row.department].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {row.missing > 0 ? row.missing : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {row.expiring > 0 ? row.expiring : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {row.overdue > 0 ? row.overdue : "—"}
                </td>
                <td className="py-2 px-3">
                  <StatusPill rowStatus={row.rowStatus} />
                </td>
                <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() => onReview(row.employee_id, row.employee_name, row.employee_number)}
                  >
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
