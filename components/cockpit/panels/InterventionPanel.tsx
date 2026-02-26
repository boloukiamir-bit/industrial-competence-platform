"use client";

import Link from "next/link";
import { InlinePanelShell } from "@/components/cockpit/InlinePanelShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type InterventionJobRow = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  employeeName: string;
  employeeNumber?: string;
};

const OVERDUE_DAYS = 7;

function isOverdue(createdAt: string, status: string): boolean {
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  const created = new Date(createdAt).getTime();
  const cutoff = Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000;
  return created < cutoff;
}

export type InterventionPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  jobs: InterventionJobRow[];
  loading?: boolean;
  sessionOk?: boolean;
};

export function InterventionPanel({
  open,
  title,
  onClose,
  jobs,
  loading = false,
  sessionOk = true,
}: InterventionPanelProps) {
  return (
    <InlinePanelShell
      open={open}
      title={title}
      subtitle="HR jobs planned or awaiting signature (CREATED, SENT, SIGNED)."
      onClose={onClose}
      dataTestId="interventions-panel"
    >
      {loading ? (
        <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
          Loading…
        </p>
      ) : jobs.length === 0 ? (
        <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>
          No active interventions.
        </p>
      ) : (
        <ul className="space-y-0">
          {jobs.map((job) => {
            const overdue = isOverdue(job.createdAt, job.status);
            const createdLabel = job.createdAt
              ? new Date(job.createdAt).toLocaleDateString("en-CA", { dateStyle: "short" })
              : "—";
            return (
              <li
                key={job.id}
                className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--hairline-soft)] last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-sm" style={{ color: "var(--text)" }}>
                  {job.title || "HR Job"}
                </span>
                <span className="min-w-0 max-w-[35%] truncate text-sm" style={{ color: "var(--text-2)" }}>
                  {job.employeeName}
                  {job.employeeNumber ? ` (${job.employeeNumber})` : ""}
                </span>
                <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-2)" }}>
                  {createdLabel}
                </span>
                <Badge variant="secondary" className="shrink-0 capitalize text-xs">
                  {job.status}
                </Badge>
                {overdue && (
                  <span className="text-xs font-medium shrink-0 px-1.5 py-0.5 rounded cockpit-status-blocking">
                    Overdue
                  </span>
                )}
                <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" asChild>
                  <Link href={`/app/hr/jobs/${job.id}`}>Open</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </InlinePanelShell>
  );
}
