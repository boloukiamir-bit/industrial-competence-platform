"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, AlertTriangle, CheckCircle, Loader2, ShieldOff } from "lucide-react";
import { NoGoResolveDrawer } from "@/components/NoGoResolveDrawer";
import { useCockpitFilters } from "@/lib/CockpitFilterContext";
import { useSessionHealth } from "@/lib/SessionHealthContext";
import { createClient } from "@/utils/supabase/client";

type DecisionRow = {
  shift_assignment_id: string;
  station_name: string;
  employee_name: string | null;
  decision_id: string | null;
  status: "active" | "none";
  root_cause: unknown;
  severity: "NO-GO" | "WARNING" | "RESOLVED";
};

export function ExecutionDecisionPanel() {
  const { date, shiftType, line } = useCockpitFilters();
  const { hasSession } = useSessionHealth();
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<DecisionRow | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const displayedRows = showResolved ? rows : rows.filter((r) => r.severity !== "RESOLVED");
  const sessionOk = hasSession === true;

  const supabase = useMemo(() => createClient(), []);

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        date,
        shift: shiftType,
        line: line || "all",
      });
      const headers: HeadersInit = {};
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/cockpit/decisions?${params}`, {
        credentials: "include",
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error || "Failed to load decisions");
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load decisions", err);
      setError(err instanceof Error ? err.message : "Failed to load decisions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [date, shiftType, line, supabase]);

  useEffect(() => {
    if (!sessionOk) return;
    loadDecisions();
  }, [sessionOk, loadDecisions]);

  const handleOpenDrawer = (row: DecisionRow) => {
    setDrawerRow(row);
    setDrawerOpen(true);
  };

  const handleResolved = (_?: "created" | "already_resolved") => {
    setDrawerOpen(false);
    setDrawerRow(null);
    loadDecisions();
  };

  const severityBadge = (row: DecisionRow) => {
    switch (row.severity) {
      case "RESOLVED":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        );
      case "WARNING":
        return (
          <Badge className="bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            WARNING
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800">
            <ShieldOff className="h-3 w-3 mr-1" />
            NO-GO
          </Badge>
        );
    }
  };

  return (
    <>
      <div className="mb-6 mx-4 sm:mx-8">
        <div className="gov-panel overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))" }}>
            <div className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4" style={{ color: "var(--nog, hsl(var(--destructive)))" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Execution Decisions</span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                {date} · {shiftType} · {line === "all" ? "All Lines" : line || "—"}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="show-resolved" className="text-xs font-normal cursor-pointer" style={{ color: "var(--text-3)" }}>
                  Show resolved
                </Label>
                <Switch
                  id="show-resolved"
                  checked={showResolved}
                  onCheckedChange={setShowResolved}
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadDecisions} disabled={loading || !sessionOk}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
          </div>
          <div className="px-5 py-4">
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive mb-3">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : displayedRows.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-2)" }}>
                {showResolved ? "No assignments for this selection." : "No issues for this selection."}
              </p>
            ) : (
              <div className="space-y-2">
                {displayedRows.map((row) => (
                  <div
                    key={row.shift_assignment_id}
                    className="flex items-center justify-between rounded-sm p-3"
                    style={{ border: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))" }}
                  >
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{row.station_name}</p>
                      <p className="text-sm" style={{ color: "var(--text-2)" }}>
                        {row.employee_name || "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {severityBadge(row)}
                      <Button
                        size="sm"
                        variant={row.severity === "RESOLVED" ? "outline" : "default"}
                        disabled={row.severity === "RESOLVED" || !sessionOk}
                        onClick={() => sessionOk && handleOpenDrawer(row)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NoGoResolveDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        shiftAssignmentId={drawerRow?.shift_assignment_id}
        stationName={drawerRow?.station_name}
        employeeName={drawerRow?.employee_name ?? undefined}
        onResolved={handleResolved}
        cockpitDate={date}
        cockpitShift={shiftType as "Day" | "Evening" | "Night"}
        cockpitLine={line || "all"}
      />
    </>
  );
}
