"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson } from "@/lib/coreFetch";
import type {
  ReadinessDrilldownResponse,
  ReadinessDrilldownStation,
} from "@/app/api/cockpit/readiness/drilldown/route";

export type ReadinessDrilldownModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
};

function formatPercent(ratio: number): string {
  if (ratio === 0) return "0%";
  const pct = Math.round(ratio * 100);
  return `${pct}%`;
}

export function ReadinessDrilldownModal({
  open,
  onOpenChange,
  shiftId,
}: ReadinessDrilldownModalProps) {
  const [stations, setStations] = useState<ReadinessDrilldownStation[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Station readiness breakdown</DialogTitle>
        </DialogHeader>
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
