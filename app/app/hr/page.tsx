"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Users, UserPlus, UserMinus, AlertTriangle, CalendarClock, Loader2 } from "lucide-react";

const STEP_STATUS_OPTIONS = ["pending", "done", "waived"] as const;
type StepStatus = (typeof STEP_STATUS_OPTIONS)[number];

type DueSoonRow = {
  employeeId: string;
  employeeNumber: string;
  name: string;
  workflowCode: string;
  stepCode: string;
  dueDate: string | null;
};

type HROverview = {
  employeesTotal: number;
  onboardingOpen: number;
  offboardingOpen: number;
  overdueSteps: number;
  dueNext7Days: number;
  topIssues: Array<{ workflowCode: string; stepCode: string; openCount: number }>;
  dueSoon: DueSoonRow[];
};

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

function dueSoonRowKey(row: DueSoonRow): string {
  return `${row.employeeId}-${row.workflowCode}-${row.stepCode}`;
}

export default function HrInboxPage() {
  const { toast } = useToast();
  const [data, setData] = useState<HROverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowEdits, setRowEdits] = useState<Record<string, { status: StepStatus; notes: string }>>({});
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/overview", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body.error as string) || res.statusText || "Failed to load overview");
        setData(null);
        return;
      }
      const json = await res.json();
      setData({
        employeesTotal: Number(json.employeesTotal ?? 0),
        onboardingOpen: Number(json.onboardingOpen ?? 0),
        offboardingOpen: Number(json.offboardingOpen ?? 0),
        overdueSteps: Number(json.overdueSteps ?? 0),
        dueNext7Days: Number(json.dueNext7Days ?? 0),
        topIssues: Array.isArray(json.topIssues) ? json.topIssues : [],
        dueSoon: Array.isArray(json.dueSoon) ? json.dueSoon : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const getRowEdit = useCallback((row: DueSoonRow) => {
    const key = dueSoonRowKey(row);
    return rowEdits[key] ?? { status: "pending" as StepStatus, notes: "" };
  }, [rowEdits]);

  const setRowEdit = useCallback((row: DueSoonRow, update: Partial<{ status: StepStatus; notes: string }>) => {
    const key = dueSoonRowKey(row);
    setRowEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { status: "pending", notes: "" }), ...update },
    }));
  }, []);

  const handleSaveRow = useCallback(
    async (row: DueSoonRow) => {
      const key = dueSoonRowKey(row);
      const edit = getRowEdit(row);
      setSavingRowKey(key);
      try {
        const res = await fetch("/api/hr/workflows/employee/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            employee_id: row.employeeId,
            workflow_code: row.workflowCode,
            step_code: row.stepCode,
            status: edit.status,
            notes: edit.notes.trim() || null,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            title: (json.error as string) || "Save failed",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Step updated" });
        await fetchOverview();
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Save failed",
          variant: "destructive",
        });
      } finally {
        setSavingRowKey(null);
      }
    },
    [getRowEdit, toast, fetchOverview]
  );

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
          <div className="h-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="hr-inbox-title">
            HR Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of open onboarding/offboarding steps and due items.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchOverview}
          disabled={loading}
          data-testid="hr-inbox-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Card 1: KPIs */}
      <Card>
        <CardHeader>
          <CardTitle>KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Employees total</p>
                <p className="text-2xl font-semibold" data-testid="kpi-employees-total">
                  {data?.employeesTotal ?? 0}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <UserPlus className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Onboarding open</p>
                <p className="text-2xl font-semibold" data-testid="kpi-onboarding-open">
                  {data?.onboardingOpen ?? 0}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <UserMinus className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Offboarding open</p>
                <p className="text-2xl font-semibold" data-testid="kpi-offboarding-open">
                  {data?.offboardingOpen ?? 0}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue steps</p>
                <p className="text-2xl font-semibold" data-testid="kpi-overdue">
                  {data?.overdueSteps ?? 0}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CalendarClock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Due next 7 days</p>
                <p className="text-2xl font-semibold" data-testid="kpi-due-next-7">
                  {data?.dueNext7Days ?? 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Top issues */}
      <Card>
        <CardHeader>
          <CardTitle>Top issues</CardTitle>
          <p className="text-sm text-muted-foreground">
            Workflow steps with the most open items.
          </p>
        </CardHeader>
        <CardContent>
          {!data?.topIssues?.length ? (
            <p className="text-muted-foreground text-center py-6">No open issues.</p>
          ) : (
            <ul className="space-y-2">
              {data.topIssues.map((item, idx) => (
                <li
                  key={`${item.workflowCode}-${item.stepCode}-${idx}`}
                  className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                  data-testid="top-issue-row"
                >
                  <span className="font-medium">{item.workflowCode}</span>
                  <span className="text-muted-foreground">{item.stepCode}</span>
                  <span className="font-semibold tabular-nums">{item.openCount}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Card 3: Due soon table */}
      <Card>
        <CardHeader>
          <CardTitle>Due soon</CardTitle>
          <p className="text-sm text-muted-foreground">
            Items due within the next 7 days.
          </p>
        </CardHeader>
        <CardContent>
          {!data?.dueSoon?.length ? (
            <p className="text-muted-foreground text-center py-6">No items due soon.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium">Employee #</th>
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Workflow</th>
                    <th className="text-left py-2 font-medium">Step</th>
                    <th className="text-left py-2 font-medium">Due date</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Notes</th>
                    <th className="text-left py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dueSoon.map((row, idx) => {
                    const rowKey = dueSoonRowKey(row);
                    const edit = getRowEdit(row);
                    const saving = savingRowKey === rowKey;
                    return (
                      <tr
                        key={`${rowKey}-${idx}`}
                        className="border-b border-border last:border-0"
                        data-testid="due-soon-row"
                      >
                        <td className="py-2 align-middle">{row.employeeNumber || "—"}</td>
                        <td className="py-2 align-middle">{row.name || "—"}</td>
                        <td className="py-2 align-middle">{row.workflowCode}</td>
                        <td className="py-2 align-middle">{row.stepCode}</td>
                        <td className="py-2 align-middle">{formatDate(row.dueDate)}</td>
                        <td className="py-2 align-middle">
                          <Select
                            value={edit.status}
                            onValueChange={(v) => setRowEdit(row, { status: v as StepStatus })}
                            disabled={saving}
                          >
                            <SelectTrigger className="h-8 w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STEP_STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 align-middle">
                          <Input
                            className="h-8 w-32 max-w-[140px] text-sm"
                            placeholder="Notes (optional)"
                            value={edit.notes}
                            onChange={(e) => setRowEdit(row, { notes: e.target.value })}
                            disabled={saving}
                          />
                        </td>
                        <td className="py-2 align-middle">
                          <Button
                            size="sm"
                            onClick={() => handleSaveRow(row)}
                            disabled={saving}
                            data-testid="due-soon-save"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
