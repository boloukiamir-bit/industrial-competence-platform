"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson } from "@/lib/coreFetch";
import { useToast } from "@/hooks/use-toast";
import type {
  ReadinessDrilldownResponse,
  ReadinessDrilldownStation,
} from "@/app/api/cockpit/readiness/drilldown/route";
import type { ReadinessDecisionGetResponse } from "@/app/api/cockpit/readiness/decision/route";

export type ReadinessStatus = "GO" | "WARNING" | "NO_GO";

export type ReadinessDrilldownModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  /** When WARNING or NO_GO, show Decision section. When GO, hide it. */
  readinessStatus?: ReadinessStatus | null;
};

function formatPercent(ratio: number): string {
  if (ratio === 0) return "0%";
  const pct = Math.round(ratio * 100);
  return `${pct}%`;
}

const DECISION_OPTIONS: { value: "ACKNOWLEDGED" | "OVERRIDE" | "STOP"; label: string }[] = [
  { value: "ACKNOWLEDGED", label: "Acknowledge" },
  { value: "OVERRIDE", label: "Override" },
  { value: "STOP", label: "Stop" },
];

export function ReadinessDrilldownModal({
  open,
  onOpenChange,
  shiftId,
  readinessStatus = null,
}: ReadinessDrilldownModalProps) {
  const { toast } = useToast();
  const [stations, setStations] = useState<ReadinessDrilldownStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedDecision, setSavedDecision] = useState<{
    decision: string;
    note: string;
    created_at: string;
  } | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<"ACKNOWLEDGED" | "OVERRIDE" | "STOP">("ACKNOWLEDGED");
  const [note, setNote] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showDecisionSection = readinessStatus === "WARNING" || readinessStatus === "NO_GO";

  useEffect(() => {
    if (!open || !shiftId) {
      setStations([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchJson<ReadinessDrilldownResponse>(
      `/api/cockpit/readiness/drilldown?shift_id=${encodeURIComponent(shiftId)}`
    )
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data?.stations) {
          setStations(res.data.stations);
        } else {
          setStations([]);
        }
      })
      .catch(() => {
        if (!cancelled) setStations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shiftId]);

  useEffect(() => {
    if (!open || !shiftId || !showDecisionSection) {
      setSavedDecision(null);
      return;
    }
    let cancelled = false;
    setDecisionLoading(true);
    fetchJson<ReadinessDecisionGetResponse>(
      `/api/cockpit/readiness/decision?shift_id=${encodeURIComponent(shiftId)}`
    )
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data?.decision) {
          setSavedDecision(res.data.decision);
        } else {
          setSavedDecision(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSavedDecision(null);
      })
      .finally(() => {
        if (!cancelled) setDecisionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shiftId, showDecisionSection]);

  const handleLogDecision = async () => {
    if (!shiftId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cockpit/readiness/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: shiftId,
          decision: selectedDecision,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to log decision", variant: "destructive" });
        return;
      }
      if (data.ok && data.decision) {
        setSavedDecision(data.decision);
        toast({ title: "Decision logged" });
      }
    } catch {
      toast({ title: "Failed to log decision", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDecisionTime = (iso: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Station readiness breakdown</DialogTitle>
        </DialogHeader>
        {showDecisionSection && (
          <div className="border-b border-border pb-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Decision</p>
            {decisionLoading ? (
              <div className="h-16 bg-muted/50 rounded animate-pulse" aria-hidden />
            ) : savedDecision ? (
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {savedDecision.decision}
                  {savedDecision.created_at && (
                    <span className="text-muted-foreground font-normal ml-2">
                      {formatDecisionTime(savedDecision.created_at)}
                    </span>
                  )}
                </p>
                {savedDecision.note && (
                  <p className="text-muted-foreground mt-1">{savedDecision.note}</p>
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 items-center">
              {DECISION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedDecision(opt.value)}
                  className={`rounded border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    selectedDecision === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="readiness-decision-note" className="sr-only">Note</label>
              <textarea
                id="readiness-decision-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional, max 500 chars)"
                maxLength={500}
                rows={2}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={handleLogDecision}
              disabled={submitting}
              className="rounded bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? "Logging…" : "Log decision"}
            </button>
          </div>
        )}
        <div className="overflow-auto flex-1 min-h-0 -mx-1 px-1">
          {loading ? (
            <div className="space-y-2" data-testid="drilldown-loading">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-muted rounded animate-pulse"
                  aria-hidden
                />
              ))}
            </div>
          ) : stations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4" data-testid="drilldown-empty">
              No station data for this shift.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Station</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground tabular-nums">Score</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Reasons</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground tabular-nums">Req / Elig</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground tabular-nums">Blockers</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground tabular-nums">Absence</th>
                  <th className="text-right py-2 pl-2 font-medium text-muted-foreground tabular-nums">Crit.</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => (
                  <tr key={s.station_id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="py-1.5 pr-3">
                      <span className="font-medium tabular-nums">{s.station_code}</span>
                      {s.station_name && (
                        <span className="text-muted-foreground ml-1 truncate max-w-[120px] inline-block align-bottom" title={s.station_name}>
                          {s.station_name}
                        </span>
                      )}
                    </td>
                    <td className="text-right py-1.5 px-2 tabular-nums">
                      <span className={s.station_score === 0 ? "text-destructive font-medium" : s.station_score < 75 ? "text-amber-600 dark:text-amber-400" : ""}>
                        {Math.round(s.station_score)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {(s.station_reason_codes ?? []).slice(0, 3).map((code) => (
                          <span
                            key={code}
                            className="inline-flex rounded border border-border/60 bg-muted/50 px-1 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {code}
                          </span>
                        ))}
                        {(s.station_reason_codes?.length ?? 0) > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{(s.station_reason_codes?.length ?? 0) - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                      {s.required_operators_count ?? "—"} / {s.eligible_operators_count}
                    </td>
                    <td className="text-right py-1.5 px-2 tabular-nums">
                      {s.compliance_blockers_count > 0 ? (
                        <span className="text-destructive font-medium">{s.compliance_blockers_count}</span>
                      ) : (
                        s.compliance_blockers_count
                      )}
                    </td>
                    <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                      {formatPercent(s.absence_ratio)}
                    </td>
                    <td className="text-right py-1.5 pl-2 tabular-nums text-muted-foreground">
                      {s.criticality_factor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
