"use client";

import Link from "next/link";
import { InlinePanelShell } from "@/components/cockpit/InlinePanelShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExpiringRow = {
  employee_id: string;
  employee_name: string;
  compliance_name: string;
  valid_to: string | null;
  status: "expired" | "expiring";
};

export type ExpiringSoonPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  expiredCount: number;
  expiringCount: number;
  top10: ExpiringRow[];
  sessionOk?: boolean;
  /** Optional: when loading overview in parent */
  loading?: boolean;
};

export function ExpiringSoonPanel({
  open,
  title,
  onClose,
  expiredCount,
  expiringCount,
  top10,
  sessionOk = true,
  loading = false,
}: ExpiringSoonPanelProps) {
  return (
    <InlinePanelShell
      open={open}
      title={title}
      subtitle="Employees with expiring or expired compliance items."
      onClose={onClose}
      dataTestId="expiring-soon-panel"
    >
      {loading ? (
        <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
          Loading…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <span
              className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: "var(--hairline)", color: "var(--text-2)", background: "var(--surface-2)" }}
            >
              Expired: {expiredCount}
            </span>
            <span
              className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: "var(--hairline)", color: "var(--text-2)", background: "var(--surface-2)" }}
            >
              Expiring (30d): {expiringCount}
            </span>
          </div>
          {top10.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
              No expiring or expired items.
            </p>
          ) : (
            <ul className="space-y-0">
              {top10.map((row, idx) => (
                <li
                  key={`${row.employee_id}-${row.compliance_name}-${row.valid_to ?? ""}-${idx}`}
                  className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--hairline-soft)] last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-sm" style={{ color: "var(--text)" }}>
                    {row.employee_name}
                  </span>
                  <span className="min-w-0 max-w-[40%] truncate text-sm" style={{ color: "var(--text-2)" }}>
                    {row.compliance_name}
                  </span>
                  <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-2)" }}>
                    {row.valid_to ?? "—"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0 px-1.5 py-0.5 rounded",
                      row.status === "expired" ? "cockpit-status-blocking" : "cockpit-status-at-risk"
                    )}
                  >
                    {row.status === "expired" ? "EXPIRED" : "EXPIRING"}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" asChild>
                    <Link href="/app/compliance">Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </InlinePanelShell>
  );
}
