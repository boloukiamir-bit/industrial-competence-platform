"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InboxActionItem, InboxLifecycleItem, InboxGovernanceItem, InboxContractItem, InboxMedicalItem, InboxTrainingItem, InboxCertificateItem } from "@/types/domain";
import type { InboxTab } from "./HrInboxTabs";
import { getSeverityFromSignals, severityToBadgeVariant } from "@/lib/ui/severity";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayPlus7Iso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("sv-SE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(dateStr);
  }
}

/** Compact label for reason_code in compliance tabs. */
function reasonCodeToLabel(code: string): string {
  const u = (code ?? "").trim().toUpperCase().replace(/-/g, "_");
  if (u === "EXPIRED" || u === "MISSING") return u;
  if (u === "EXPIRING_SOON" || u === "EXPIRING SOON") return "EXPIRING SOON";
  if (u) return u.replace(/_/g, " ");
  return "—";
}

/** Sort key: ILLEGAL first, then WARNING. */
function severityOrder(s: "ILLEGAL" | "WARNING"): number {
  return s === "ILLEGAL" ? 0 : 1;
}

type ComplianceRow = InboxContractItem | InboxMedicalItem | InboxTrainingItem | InboxCertificateItem;

function sortComplianceRows<T extends ComplianceRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const sev = severityOrder(a.severity) - severityOrder(b.severity);
    if (sev !== 0) return sev;
    const daysA = a.days_to_expiry ?? Infinity;
    const daysB = b.days_to_expiry ?? Infinity;
    if (daysA !== daysB) return daysA - daysB;
    return (a.employee_name ?? "").localeCompare(b.employee_name ?? "", undefined, { sensitivity: "base" });
  });
}

function ComplianceSummaryHeader({ illegal, warning }: { illegal: number; warning: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-3 text-sm tabular-nums">
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 font-medium text-destructive">
          ILLEGAL: {illegal}
        </span>
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          WARNING: {warning}
        </span>
      </span>
    </div>
  );
}

export type InboxTableProps = {
  tab: InboxTab;
  items: InboxActionItem[] | InboxLifecycleItem[] | InboxGovernanceItem[] | InboxContractItem[] | InboxMedicalItem[] | InboxTrainingItem[] | InboxCertificateItem[];
  loading: boolean;
  error: string | null;
};

export function InboxTable({ tab, items, loading, error }: InboxTableProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    const emptyConfig =
      tab === "actions"
        ? { message: "No open actions", href: "/app/hr/compliance", label: "Go to HR Compliance" }
        : tab === "lifecycle"
          ? { message: "No lifecycle events", href: "/app/employees", label: "Go to Employees" }
          : tab === "contract"
            ? { message: "No contract issues", href: "/app/employees", label: "Go to Employees" }
            : tab === "medical"
              ? { message: "No medical issues", href: "/app/employees", label: "Go to Employees" }
              : tab === "training"
                ? { message: "No training issues", href: "/app/employees", label: "Go to Employees" }
                : tab === "certificates"
                  ? { message: "No certificate issues", href: "/app/employees", label: "Go to Employees" }
                  : { message: "No governance events", href: "/app/cockpit", label: "Go to Cockpit" };
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <p className="text-muted-foreground text-sm max-w-sm">{emptyConfig.message}</p>
        <Link
          href={emptyConfig.href}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {emptyConfig.label}
        </Link>
      </div>
    );
  }

  if (tab === "actions") {
    const rows = items as InboxActionItem[];
    const today = todayIso();
    const dueEnd = todayPlus7Iso();
    const isClosed = (s: string) => s === "CLOSED";
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="min-w-0">Reason</TableHead>
            <TableHead className="min-w-0">Next action</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isOverdue = r.due_date != null && r.due_date < today && !isClosed(r.status);
            const isDueSoon = r.due_date != null && r.due_date >= today && r.due_date <= dueEnd && !isClosed(r.status);
            const isUnassigned = r.assigned_to_user_id == null;
            const isInProgress = r.status === "IN_PROGRESS";
            const reasonBadges: string[] = [];
            if (isOverdue) reasonBadges.push("OVERDUE");
            if (isDueSoon) reasonBadges.push("DUE_SOON");
            if (isUnassigned) reasonBadges.push("UNASSIGNED");
            if (isInProgress) reasonBadges.push("IN_PROGRESS");
            let nextAction: string;
            if (isUnassigned) nextAction = "Assign owner";
            else if (isOverdue) nextAction = "Escalate / update due date";
            else if (isDueSoon) nextAction = "Follow up";
            else nextAction = "Review";
            return (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => router.push(`/app/hr/compliance?tab=actions&action_id=${encodeURIComponent(r.id)}`)}
              >
                <TableCell className="font-medium">{r.title || "—"}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>{formatDate(r.due_date)}</TableCell>
                <TableCell>{r.assigned_to_user_id ? "Assigned" : "Unassigned"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {reasonBadges.map((b) => {
                      const level = getSeverityFromSignals({
                        overdue: b === "OVERDUE",
                        dueSoon: b === "DUE_SOON",
                        unassigned: b === "UNASSIGNED",
                      });
                      const { variant, className } = severityToBadgeVariant(level);
                      return (
                        <Badge key={b} variant={variant} className={className} size="sm">
                          {b}
                        </Badge>
                      );
                    })}
                    {reasonBadges.length === 0 && "—"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{nextAction}</TableCell>
                <TableCell>{formatDate(r.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  if (tab === "lifecycle") {
    const rows = items as InboxLifecycleItem[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead className="min-w-0">Reason</TableHead>
            <TableHead className="min-w-0">Next action</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const to = (r.to ?? "").toUpperCase();
            const reasonBadge = to === "INACTIVE" ? "DEACTIVATED" : to === "TERMINATED" ? "TERMINATED" : null;
            const nextAction =
              to === "INACTIVE"
                ? "Review shift assignments & access"
                : to === "TERMINATED"
                  ? "Confirm offboarding tasks"
                  : "—";
            return (
              <TableRow
                key={`${r.target_id}-${r.created_at}-${i}`}
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => router.push(`/app/employees?highlight_id=${encodeURIComponent(r.target_id)}`)}
              >
                <TableCell className="font-medium">{r.employee_label}</TableCell>
                <TableCell>{r.from}</TableCell>
                <TableCell>{r.to}</TableCell>
                <TableCell>
                  {reasonBadge ? (
                    (() => {
                      const level = getSeverityFromSignals({});
                      const { variant, className } = severityToBadgeVariant(level);
                      return (
                        <Badge variant={variant} className={className} size="sm">
                          {reasonBadge}
                        </Badge>
                      );
                    })()
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{nextAction}</TableCell>
                <TableCell>{formatDateTime(r.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  if (tab === "contract") {
    const rows = sortComplianceRows(items as InboxContractItem[]);
    const illegal = rows.filter((r) => r.severity === "ILLEGAL").length;
    const warning = rows.filter((r) => r.severity === "WARNING").length;
    return (
      <>
        <ComplianceSummaryHeader illegal={illegal} warning={warning} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="min-w-0">Reason</TableHead>
              <TableHead className="tabular-nums">Contract end</TableHead>
              <TableHead className="tabular-nums w-24">Days</TableHead>
              <TableHead className="w-[1%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const level = getSeverityFromSignals({
                legitimacy: r.severity === "ILLEGAL" ? "LEGAL_STOP" : undefined,
                readiness: r.severity === "WARNING" ? "WARNING" : undefined,
              });
              const { variant, className } = severityToBadgeVariant(level);
              return (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">{r.employee_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={variant} className={className} size="sm">
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-medium">
                    {reasonCodeToLabel(r.reason_code)}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{formatDate(r.contract_end_date)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.days_to_expiry != null ? String(r.days_to_expiry) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/employees/${encodeURIComponent(r.employee_id)}?edit=1&return_to=${encodeURIComponent(`/app/hr/inbox?tab=${tab}`)}`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </>
    );
  }

  if (tab === "medical") {
    const rows = sortComplianceRows(items as InboxMedicalItem[]);
    const illegal = rows.filter((r) => r.severity === "ILLEGAL").length;
    const warning = rows.filter((r) => r.severity === "WARNING").length;
    return (
      <>
        <ComplianceSummaryHeader illegal={illegal} warning={warning} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="min-w-0">Reason</TableHead>
              <TableHead className="tabular-nums">Valid to</TableHead>
              <TableHead className="tabular-nums w-24">Days</TableHead>
              <TableHead className="w-[1%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const level = getSeverityFromSignals({
                legitimacy: r.severity === "ILLEGAL" ? "LEGAL_STOP" : undefined,
                readiness: r.severity === "WARNING" ? "WARNING" : undefined,
              });
              const { variant, className } = severityToBadgeVariant(level);
              return (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">{r.employee_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={variant} className={className} size="sm">
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-medium">
                    {reasonCodeToLabel(r.reason_code)}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{formatDate(r.valid_to)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.days_to_expiry != null ? String(r.days_to_expiry) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/employees/${encodeURIComponent(r.employee_id)}?edit=1&return_to=${encodeURIComponent(`/app/hr/inbox?tab=${tab}`)}`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </>
    );
  }

  if (tab === "training") {
    const rows = sortComplianceRows(items as InboxTrainingItem[]);
    const illegal = rows.filter((r) => r.severity === "ILLEGAL").length;
    const warning = rows.filter((r) => r.severity === "WARNING").length;
    return (
      <>
        <ComplianceSummaryHeader illegal={illegal} warning={warning} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="min-w-0">Reason</TableHead>
              <TableHead className="tabular-nums">Valid to</TableHead>
              <TableHead className="tabular-nums w-24">Days</TableHead>
              <TableHead className="w-[1%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const level = getSeverityFromSignals({
                legitimacy: r.severity === "ILLEGAL" ? "LEGAL_STOP" : undefined,
                readiness: r.severity === "WARNING" ? "WARNING" : undefined,
              });
              const { variant, className } = severityToBadgeVariant(level);
              return (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">{r.employee_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={variant} className={className} size="sm">
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-medium">
                    {reasonCodeToLabel(r.reason_code)}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{formatDate(r.valid_to)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.days_to_expiry != null ? String(r.days_to_expiry) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/employees/${encodeURIComponent(r.employee_id)}?edit=1&return_to=${encodeURIComponent(`/app/hr/inbox?tab=${tab}`)}`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </>
    );
  }

  if (tab === "certificates") {
    const rows = sortComplianceRows(items as InboxCertificateItem[]);
    const illegal = rows.filter((r) => r.severity === "ILLEGAL").length;
    const warning = rows.filter((r) => r.severity === "WARNING").length;
    return (
      <>
        <ComplianceSummaryHeader illegal={illegal} warning={warning} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="min-w-0">Reason</TableHead>
              <TableHead className="tabular-nums">Valid to</TableHead>
              <TableHead className="tabular-nums w-24">Days</TableHead>
              <TableHead className="w-[1%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const level = getSeverityFromSignals({
                legitimacy: r.severity === "ILLEGAL" ? "LEGAL_STOP" : undefined,
                readiness: r.severity === "WARNING" ? "WARNING" : undefined,
              });
              const { variant, className } = severityToBadgeVariant(level);
              return (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">{r.employee_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={variant} className={className} size="sm">
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-medium">
                    {reasonCodeToLabel(r.reason_code)}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{formatDate(r.valid_to)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.days_to_expiry != null ? String(r.days_to_expiry) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/employees/${encodeURIComponent(r.employee_id)}?edit=1&return_to=${encodeURIComponent(`/app/hr/inbox?tab=${tab}`)}`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </>
    );
  }

  if (tab === "governance") {
    const rows = items as InboxGovernanceItem[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Legitimacy</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead className="min-w-0">Reason</TableHead>
            <TableHead className="min-w-0">Next action</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const reasonBadge =
              r.legitimacy_status === "LEGAL_STOP"
                ? "LEGAL_STOP"
                : r.readiness_status === "NO_GO"
                  ? "NO_GO"
                  : r.readiness_status === "WARNING"
                    ? "WARNING"
                    : null;
            const level = getSeverityFromSignals({
              legitimacy: r.legitimacy_status,
              readiness: r.readiness_status,
            });
            const { variant, className } = severityToBadgeVariant(level);
            return (
              <TableRow
                key={`${r.action}-${r.created_at}-${r.target_id}-${i}`}
                className="cursor-pointer hover:bg-muted/60"
                onClick={() =>
                  router.push(
                    `/app/cockpit?action=${encodeURIComponent(r.action)}&target_id=${encodeURIComponent(r.target_id ?? "")}`
                  )
                }
              >
                <TableCell className="font-medium">{r.action}</TableCell>
                <TableCell>{r.target_type} {r.target_id ? `(${r.target_id.slice(0, 8)}…)` : "—"}</TableCell>
                <TableCell>{r.legitimacy_status}</TableCell>
                <TableCell>{r.readiness_status}</TableCell>
                <TableCell>
                  {reasonBadge ? (
                    <Badge variant={variant} className={className} size="sm">
                      {reasonBadge}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">Open audit</TableCell>
                <TableCell>{formatDateTime(r.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return null;
}
