"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KpiTile } from "@/components/cockpit/KpiTile";
import { getSeverityFromSignals, severityToKpiTileChipVariant } from "@/lib/ui/severity";

export type ComplianceActionsSummary = {
  openCount: number;
  overdueCount: number;
  due7DaysCount: number;
  topAssignees: Array<{
    assignedToUserId: string | null;
    openCount: number;
    displayName: string;
  }>;
};

const HR_COMPLIANCE_PATH = "/app/hr/compliance";

function buildActionsUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `${HR_COMPLIANCE_PATH}?${q.toString()}`;
}

export type ComplianceActionsOverviewProps = {
  summary: ComplianceActionsSummary | null;
  loading: boolean;
  sessionOk: boolean;
};

export function ComplianceActionsOverview({
  summary,
  loading,
  sessionOk,
}: ComplianceActionsOverviewProps) {
  const router = useRouter();

  const openCount = summary?.openCount ?? 0;
  const overdueCount = summary?.overdueCount ?? 0;
  const due7Count = summary?.due7DaysCount ?? 0;
  const topAssignees = summary?.topAssignees ?? [];
  const topOwner = topAssignees[0];
  const topOwnerDisplayName = topOwner?.displayName ?? "Unassigned";
  const topOwnerValue = topOwner?.openCount ?? 0;

  const handleOpen = () => router.push(buildActionsUrl({ actions_status: "open" }));
  const handleOverdue = () => router.push(buildActionsUrl({ actions_overdue: "1" }));
  const handleDue7 = () => router.push(buildActionsUrl({ actions_due_days: "7" }));
  const handleTopOwner = () => router.push(buildActionsUrl({ actions_status: "open" }));
  const viewActionsHref = buildActionsUrl({ tab: "actions" });

  if (loading) {
    return (
      <section
        className="rounded-xl border border-[var(--hairline)] bg-white p-4 shadow-sm"
        data-testid="compliance-actions-overview"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)] mb-3">
          COMPLIANCE ACTIONS
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[72px] rounded-lg animate-pulse"
              style={{ background: "var(--surface-3, #F2F4F7)" }}
            />
          ))}
        </div>
        <div className="mt-3 h-4 w-24 rounded animate-pulse" style={{ background: "var(--surface-3)" }} />
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-[var(--hairline)] bg-white p-4 shadow-sm"
      data-testid="compliance-actions-overview"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)] mb-3">
        COMPLIANCE ACTIONS
      </h2>
      {openCount === 0 && (
        <p className="text-xs text-[var(--text-2)] mb-3">No open actions</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile
          tileId="compliance-actions-open"
          title="Open"
          primaryValue={openCount}
          onClick={sessionOk ? handleOpen : () => {}}
        />
        <KpiTile
          tileId="compliance-actions-overdue"
          title="Overdue"
          primaryValue={overdueCount}
          statusChip={overdueCount > 0 ? "OVERDUE" : undefined}
          statusChipVariant={severityToKpiTileChipVariant(getSeverityFromSignals({ overdue: overdueCount > 0 }))}
          onClick={sessionOk ? handleOverdue : () => {}}
        />
        <KpiTile
          tileId="compliance-actions-due7"
          title="Due ≤ 7 days"
          primaryValue={due7Count}
          onClick={sessionOk ? handleDue7 : () => {}}
        />
        <KpiTile
          tileId="compliance-actions-top-owner"
          title={topOwnerDisplayName}
          primaryValue={topOwnerValue}
          secondaryLabel="open"
          onClick={sessionOk ? handleTopOwner : () => {}}
        />
      </div>
      {topAssignees.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[0.6875rem] text-[var(--text-2)]">
          {topAssignees.map((a, i) => (
            <li key={a.assignedToUserId ?? `null-${i}`}>
              {a.displayName} — {a.openCount} open
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.6875rem] text-[var(--text-2)]">No assignees yet</p>
      )}
      <footer className="mt-3 pt-2 border-t border-[var(--hairline)]">
        <Link
          href={viewActionsHref}
          className="text-xs font-medium text-primary hover:underline"
        >
          View actions
        </Link>
      </footer>
    </section>
  );
}
