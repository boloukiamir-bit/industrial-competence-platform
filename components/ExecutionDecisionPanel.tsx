"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, Loader2, ShieldOff } from "lucide-react";
import { NoGoResolveDrawer } from "@/components/NoGoResolveDrawer";
import { createClient } from "@/utils/supabase/client";

type AssignmentRow = {
  id: string;
  stationName: string;
  employeeName?: string | null;
  status?: string | null;
};

const shiftOptions = ["Day", "Evening", "Night"] as const;

export function ExecutionDecisionPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [shiftType, setShiftType] = useState<(typeof shiftOptions)[number]>("Day");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAssignment, setDrawerAssignment] = useState<AssignmentRow | null>(null);

  useEffect(() => {
    async function fetchLines() {
      try {
        const response = await fetch("/api/cockpit/lines");
        if (response.ok) {
          const data = await response.json();
          setLines(data.lines || []);
          setSelectedLine((data.lines || [])[0] || null);
        }
      } catch (err) {
        console.error("Failed to load lines", err);
      }
    }
    fetchLines();
  }, []);

  const supabase = useMemo(() => createClient(), []);

  const loadAssignments = async () => {
    if (!selectedLine) return;
    setLoading(true);
    setError(null);
    try {
      const ensureRes = await fetch("/api/shift-context/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_date: date,
          shift_type: shiftType,
          line: selectedLine,
        }),
      });

      if (!ensureRes.ok) {
        const data = await ensureRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to ensure shift context");
      }

      const ensureData = await ensureRes.json();
      const shiftId = ensureData.shift_id as string | undefined;
      if (!shiftId) {
        setAssignments([]);
        return;
      }

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("shift_assignments")
        .select(
          `
            id,
            status,
            assignment_date,
            employee:employee_id(name),
            station:station_id(name)
          `
        )
        .eq("shift_id", shiftId)
        .eq("assignment_date", date);

      if (assignmentError) {
        throw assignmentError;
      }

      const normalized: AssignmentRow[] = (assignmentRows || []).map((row: any) => ({
        id: row.id,
        stationName: row.station?.name || "Station",
        employeeName: row.employee?.name || null,
        status: row.status,
      }));

      setAssignments(normalized);

      const ids = normalized.map((r) => r.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: decisions, error: decisionsError } = await supabase
          .from("execution_decisions")
          .select("target_id")
          .eq("decision_type", "resolve_no_go")
          .eq("target_type", "shift_assignment")
          .eq("status", "active")
          .in("target_id", ids);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLine) {
      loadAssignments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLine, shiftType, date]);

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

  if (!lines.length) {
    return null;
  }

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
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
              <Select value={shiftType} onValueChange={(v) => setShiftType(v as (typeof shiftOptions)[number])}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  {shiftOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedLine ?? undefined}
                onValueChange={(v) => setSelectedLine(v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Line" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line} value={line}>
                      {line}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
