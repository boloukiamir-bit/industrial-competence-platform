"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2, ShieldOff } from "lucide-react";
import { NoGoResolveDrawer } from "@/components/NoGoResolveDrawer";
import { createClient } from "@/utils/supabase/client";
import { useCockpitFilters } from "@/lib/CockpitFilterContext";

type AssignmentRow = {
  id: string;
  stationName: string;
  employeeName?: string | null;
  status?: string | null;
};

export function ExecutionDecisionPanel() {
  const { date, shiftType, line } = useCockpitFilters();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAssignment, setDrawerAssignment] = useState<AssignmentRow | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      let assignmentIds: string[] = [];

      if (line === "all") {
        const siRes = await fetch(
          `/api/cockpit/shift-ids?date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shiftType)}`,
          { credentials: "include" }
        );
        if (!siRes.ok) {
          const d = await siRes.json().catch(() => ({}));
          throw new Error(d.error || "Failed to load shift IDs");
        }
        const { shift_ids } = await siRes.json();
        if (!Array.isArray(shift_ids) || shift_ids.length === 0) {
          setAssignments([]);
          setResolvedIds(new Set());
          return;
        }
        const { data: assignmentRows, error: assignmentError } = await supabase
          .from("shift_assignments")
          .select(
            `id, status, assignment_date, employee:employee_id(name), station:station_id(name)`
          )
          .in("shift_id", shift_ids)
          .eq("assignment_date", date);

        if (assignmentError) throw assignmentError;

        const normalized: AssignmentRow[] = (assignmentRows || []).map((row: any) => ({
          id: row.id,
          stationName: row.station?.name || "Station",
          employeeName: row.employee?.name || null,
          status: row.status,
        }));
        setAssignments(normalized);
        assignmentIds = normalized.map((r) => r.id).filter(Boolean);
      } else if (line) {
        const ensureRes = await fetch("/api/shift-context/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shift_date: date, shift_type: shiftType, line }),
        });

        if (!ensureRes.ok) {
          const data = await ensureRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to ensure shift context");
        }

        const ensureData = await ensureRes.json();
        const shiftId = ensureData.shift_id as string | undefined;
        if (!shiftId) {
          setAssignments([]);
          setResolvedIds(new Set());
          return;
        }

        const { data: assignmentRows, error: assignmentError } = await supabase
          .from("shift_assignments")
          .select(
            `id, status, assignment_date, employee:employee_id(name), station:station_id(name)`
          )
          .eq("shift_id", shiftId)
          .eq("assignment_date", date);

        if (assignmentError) throw assignmentError;

        const normalized: AssignmentRow[] = (assignmentRows || []).map((row: any) => ({
          id: row.id,
          stationName: row.station?.name || "Station",
          employeeName: row.employee?.name || null,
          status: row.status,
        }));
        setAssignments(normalized);
        assignmentIds = normalized.map((r) => r.id).filter(Boolean);
      } else {
        setAssignments([]);
        setResolvedIds(new Set());
        return;
      }

      if (assignmentIds.length > 0) {
        const { data: decisions, error: decisionsError } = await supabase
          .from("execution_decisions")
          .select("target_id")
          .eq("decision_type", "resolve_no_go")
          .eq("target_type", "shift_assignment")
          .eq("status", "active")
          .in("target_id", assignmentIds);

        if (decisionsError) {
          console.warn("Failed to load resolved state", decisionsError);
          setResolvedIds(new Set());
        } else {
          setResolvedIds(new Set((decisions || []).map((d: any) => d.target_id)));
        }
      } else {
        setResolvedIds(new Set());
      }
    } catch (err) {
      console.error("Failed to load assignments", err);
      setError(err instanceof Error ? err.message : "Failed to load assignments");
      setAssignments([]);
      setResolvedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, shiftType, line]);

  const handleOpenDrawer = (row: AssignmentRow) => {
    setDrawerAssignment(row);
    setDrawerOpen(true);
  };

  const handleResolved = (status: "created" | "already_resolved") => {
    if (drawerAssignment) {
      setResolvedIds((prev) => new Set([...prev, drawerAssignment.id]));
    }
    setDrawerOpen(false);
  };

  return (
    <>
      <div className="mb-4">
        <Card>
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-destructive" />
              Execution Decisions
            </CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">
                {date} · {shiftType} · {line === "all" ? "All Lines" : (line || "—")}
              </span>
              <Button variant="outline" size="sm" onClick={loadAssignments} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive mb-3">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading shift assignments...
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments for this selection.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((row) => {
                  const resolved = resolvedIds.has(row.id);
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">{row.stationName}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.employeeName || "Unassigned"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {resolved ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="secondary">NO-GO</Badge>
                        )}
                        <Button
                          size="sm"
                          variant={resolved ? "outline" : "default"}
                          disabled={resolved}
                          onClick={() => handleOpenDrawer(row)}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NoGoResolveDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        shiftAssignmentId={drawerAssignment?.id}
        stationName={drawerAssignment?.stationName}
        employeeName={drawerAssignment?.employeeName || undefined}
        onResolved={handleResolved}
      />
    </>
  );
}
