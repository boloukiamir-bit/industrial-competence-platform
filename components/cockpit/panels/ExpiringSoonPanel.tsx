"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InlinePanelShell } from "@/components/cockpit/InlinePanelShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
  const router = useRouter();
  const { toast } = useToast();
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  const rowKey = (row: ExpiringRow) => `${row.employee_id}-${row.compliance_name}-${row.valid_to ?? ""}`;

  const handleCreateAction = async (row: ExpiringRow) => {
    const key = rowKey(row);
    setCreatingKey(key);
    try {
      const res = await fetch("/api/hr/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          template_code: "CERTIFICATE_RENEWAL",
          employee_id: row.employee_id,
          metadata: {
            compliance_name: row.compliance_name,
            valid_to: row.valid_to ?? "",
            status: row.status,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (data.error as string) || "Failed to create action", variant: "destructive" });
        return;
      }
      toast({ title: "Action job created." });
      router.push(`/app/hr/jobs/${data.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create action", variant: "destructive" });
    } finally {
      setCreatingKey(null);
    }
  };

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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    disabled={creatingKey === rowKey(row)}
                    onClick={() => handleCreateAction(row)}
                    data-testid={`expiring-create-action-${row.employee_id}`}
                  >
                    {creatingKey === rowKey(row) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Create Action"
                    )}
                  </Button>
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
