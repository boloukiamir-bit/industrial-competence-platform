"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";

export type StationHealthOverviewProps = {
  issues: CockpitIssueRow[];
  /** Optional: area order (e.g. OMM, PACK, LOG, BEARB). If not provided, areas sorted alphabetically. */
  areaOrder?: string[];
  className?: string;
};

type StationStatus = "ILLEGAL" | "RED" | "AMBER" | "GREEN";

function getStationStatus(issue: CockpitIssueRow): StationStatus {
  const it = (issue as { issue_type?: string }).issue_type;
  if (it === "ILLEGAL") return "ILLEGAL";
  if (!issue.resolved) {
    return issue.severity === "BLOCKING" ? "RED" : "AMBER";
  }
  return "GREEN";
}

function statusDotClass(status: StationStatus): string {
  switch (status) {
    case "ILLEGAL":
    case "RED":
      return "bg-red-500";
    case "AMBER":
      return "bg-amber-500";
    case "GREEN":
      return "bg-green-500";
    default:
      return "bg-muted-foreground";
  }
}

export function StationHealthOverview({
  issues,
  areaOrder = ["OMM", "PACK", "LOG", "BEARB"],
  className,
}: StationHealthOverviewProps) {
  const { byArea, summary } = useMemo(() => {
    const stationToStatus = new Map<string, StationStatus>();
    const stationToInfo = new Map<string, { area: string; stationId: string; stationCode: string | null; stationName: string | null }>();
    const order: StationStatus[] = ["ILLEGAL", "RED", "AMBER", "GREEN"];
    const worse = (a: StationStatus, b: StationStatus) => (order.indexOf(a) <= order.indexOf(b) ? a : b);

    for (const issue of issues) {
      const area = (issue.area ?? issue.line ?? "—").trim() || "—";
      const key = `${issue.station_id ?? ""}:${issue.shift_code ?? ""}:${issue.date ?? ""}`;
      const status = getStationStatus(issue);
      const existing = stationToStatus.get(key);
      stationToStatus.set(key, existing ? worse(existing, status) : status);
      if (!stationToInfo.has(key)) {
        stationToInfo.set(key, {
          area,
          stationId: issue.station_id ?? "",
          stationCode: issue.station_code ?? null,
          stationName: issue.station_name ?? null,
        });
      }
    }

    let illegal = 0;
    let red = 0;
    let amber = 0;
    let green = 0;
    const map = new Map<string, Array<{ stationId: string; stationCode: string | null; stationName: string | null; status: StationStatus }>>();
    for (const [key, status] of stationToStatus) {
      if (status === "ILLEGAL") illegal++;
      else if (status === "RED") red++;
      else if (status === "AMBER") amber++;
      else green++;
      const info = stationToInfo.get(key);
      if (!info) continue;
      const list = map.get(info.area) ?? [];
      list.push({
        stationId: info.stationId,
        stationCode: info.stationCode,
        stationName: info.stationName,
        status,
      });
      map.set(info.area, list);
    }

    const areas = Array.from(map.keys()).sort((a, b) => {
      const ai = areaOrder.indexOf(a);
      const bi = areaOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    const byArea: Array<{ area: string; stations: Array<{ stationId: string; stationCode: string | null; stationName: string | null; status: StationStatus }> }> = [];
    for (const area of areas) {
      const stations = map.get(area) ?? [];
      byArea.push({ area, stations });
    }

    return {
      byArea,
      summary: { illegal, red, amber, green },
    };
  }, [issues, areaOrder]);

  if (byArea.length === 0 && summary.illegal === 0 && summary.red === 0 && summary.amber === 0 && summary.green === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.25)]",
        className
      )}
      data-testid="station-health-overview"
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400 mb-2">
        Station health overview
      </p>
      <p className="text-xs font-medium text-slate-300 mb-3 tabular-nums">
        ILLEGAL {summary.illegal} | RED {summary.red} | AMBER {summary.amber} | GREEN {summary.green}
      </p>
      <div className="space-y-3">
        {byArea.map(({ area, stations }) => (
          <div key={area}>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{area}</p>
            <div className="flex flex-wrap gap-1.5">
              {stations.map((s) => (
                <span
                  key={s.stationId}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] font-medium",
                    "text-slate-200"
                  )}
                >
                  <span
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(s.status))}
                    aria-hidden
                  />
                  {s.stationName ?? s.stationCode ?? s.stationId?.slice(0, 8) ?? "—"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
