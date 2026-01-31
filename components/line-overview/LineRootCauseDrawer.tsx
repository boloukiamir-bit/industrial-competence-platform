"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, AlertTriangle, Users, Wrench, Target } from "lucide-react";

export type RootCauseType = "CAPACITY" | "SKILLS" | "COVERAGE";

export type LineRootCauseStation = {
  stationId: string;
  stationCode: string;
  stationName: string;
  requiredHours: number;
  assignedHours: number;
  gapHours: number;
};

export type LineRootCauseLine = {
  lineCode: string;
  lineName: string;
  gapHours: number;
  competenceStatus: "NO-GO" | "WARNING" | "OK";
  eligibleOperatorsCount: number;
  root_cause?: { primary: RootCauseType | string; causes: (RootCauseType | string)[] };
  stations: LineRootCauseStation[];
  missing_skill_codes: string[];
  recommended_action: "assign" | "call_in" | "swap";
};

type LineRootCauseDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: LineRootCauseLine | null;
  date: string;
  shift: string;
  onResolve?: (line: LineRootCauseLine) => void;
  /** When set, station rows are clickable; called with (station) to open assign/suggest for that station. */
  onStationClick?: (station: LineRootCauseStation) => void;
};

const primaryLabels: Record<RootCauseType, string> = {
  CAPACITY: "Capacity (assigned < required)",
  SKILLS: "Skills (no eligible meeting station skills)",
  COVERAGE: "Coverage (eligible below threshold)",
};

const actionLabels: Record<string, string> = {
  assign: "Assign",
  call_in: "Call in",
  swap: "Swap",
};

export function LineRootCauseDrawer({
  open,
  onOpenChange,
  line,
  date,
  shift,
  onResolve,
  onStationClick,
}: LineRootCauseDrawerProps) {
  if (!line) return null;

  const primary = (line.root_cause?.primary ?? "CAPACITY") as RootCauseType;
  const showResolve =
    (line.competenceStatus === "NO-GO" || line.competenceStatus === "WARNING") && onResolve;

  const lineOverviewParams = new URLSearchParams();
  lineOverviewParams.set("date", date);
  lineOverviewParams.set("shift", shift.toLowerCase());
  lineOverviewParams.set("line", line.lineCode);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            View root cause — {line.lineName}
          </SheetTitle>
          <SheetDescription>
            {line.lineCode} • {date} • {shift} • Gap: {line.gapHours.toFixed(1)}h
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Root cause</p>
            <Badge variant="secondary" className="capitalize">
              {primaryLabels[primary]}
            </Badge>
            {line.root_cause?.causes && line.root_cause.causes.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Also: {line.root_cause.causes.slice(1).join(", ")}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              Stations ({line.stations.length})
            </p>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {line.stations.map((st) => (
                <li key={st.stationId}>
                  <button
                    type="button"
                    onClick={() => onStationClick?.(st)}
                    className="w-full flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/50 hover:bg-muted text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={!onStationClick}
                    data-testid={`station-row-${st.stationId}`}
                  >
                    <span className="font-medium truncate">{st.stationName || st.stationCode}</span>
                    <span className={st.gapHours > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {st.gapHours > 0 ? `${st.gapHours.toFixed(1)}h gap` : "OK"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Eligible operators: <strong>{line.eligibleOperatorsCount}</strong>
            </span>
          </div>

          {line.missing_skill_codes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Missing skill codes (top 3)</p>
              <div className="flex flex-wrap gap-1">
                {line.missing_skill_codes.map((code) => (
                  <Badge key={code} variant="outline" className="text-xs">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              Recommended next action
            </p>
            <Badge variant="default" className="capitalize">
              {actionLabels[line.recommended_action] ?? line.recommended_action}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/app/line-overview?${lineOverviewParams.toString()}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open Line Overview
              </Link>
            </Button>
            {showResolve && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onResolve?.(line);
                }}
                data-testid="button-resolve-from-drawer"
              >
                Resolve
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
