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
import { cn } from "@/lib/utils";
import type { InboxActionItem, InboxLifecycleItem, InboxGovernanceItem, InboxContractItem, InboxMedicalItem } from "@/types/domain";
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

export type InboxTableProps = {
  tab: InboxTab;
  items: InboxActionItem[] | InboxLifecycleItem[] | InboxGovernanceItem[] | InboxContractItem[] | InboxMedicalItem[];
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
              : { message: "No governance events", href: "/app/cockpit", label: "Go to Cockpit" };
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="text-muted-foreground text-sm">{emptyConfig.message}</p>
        <Link
          href={emptyConfig.href}
          className="text-sm font-medium text-primary hover:underline"
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
    const rows = items as InboxContractItem[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead className="min-w-0">Reason</TableHead>
            <TableHead>Contract end</TableHead>
            <TableHead>Days to expiry</TableHead>
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
                <TableCell className="text-muted-foreground text-xs">{r.reason_code}</TableCell>
                <TableCell>{formatDate(r.contract_end_date)}</TableCell>
                <TableCell>{r.days_to_expiry != null ? String(r.days_to_expiry) : "—"}</TableCell>
                <TableCell>
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/app/employees/${encodeURIComponent(r.employee_id)}?edit=1`}>
                      Edit employee
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  if (tab === "medical") {
    const rows = items as InboxMedicalItem[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead className="min-w-0">Reason</TableHead>
            <TableHead>Valid to</TableHead>
            <TableHead>Days to expiry</TableHead>
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
                <TableCell className="text-muted-foreground text-xs">{r.reason_code}</TableCell>
                <TableCell>{formatDate(r.valid_to)}</TableCell>
                <TableCell>{r.days_to_expiry != null ? String(r.days_to_expiry) : "—"}</TableCell>
                <TableCell>
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/app/employees/${encodeURIComponent(r.employee_id)}?edit=1`}>
                      Edit employee
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
