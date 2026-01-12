"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { SafetyObservation } from "@/types/cockpit";

interface SafetyWidgetProps {
  observations: SafetyObservation[];
  openActionsCount: number;
  onCreateObservation?: () => void;
}

const severityConfig = {
  high: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  medium: {
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  low: {
    badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
};

function formatObservedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export function SafetyWidget({ observations, openActionsCount, onCreateObservation }: SafetyWidgetProps) {
  const openObservations = observations.filter(o => o.status === "open");

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Shield className="h-4 w-4 text-green-500" />
            Safety Pulse
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onCreateObservation}
            data-testid="button-create-observation"
          >
            <Plus className="h-3 w-3 mr-1" />
            Report
          </Button>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="text-center">
            <p className="text-2xl font-bold">{observations.length}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{openObservations.length}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{openActionsCount}</p>
            <p className="text-xs text-muted-foreground">Safety Actions</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
        {observations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">No observations this week.</p>
          </div>
        ) : (
          observations.slice(0, 5).map((obs) => {
            const config = severityConfig[obs.severity];
            return (
              <div
                key={obs.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover-elevate"
                data-testid={`observation-item-${obs.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${config.badge}`}>
                      {config.icon}
                      <span className="ml-1 capitalize">{obs.severity}</span>
                    </Badge>
                    {obs.status === "action_created" && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        Action Created
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{obs.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {obs.location || obs.stationName || "Unknown location"} · {formatObservedDate(obs.observedAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
