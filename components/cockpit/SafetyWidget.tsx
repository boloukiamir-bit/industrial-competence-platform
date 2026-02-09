"use client";

import { Button } from "@/components/ui/button";
import { Shield, Plus, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { SafetyObservation } from "@/types/cockpit";

interface SafetyWidgetProps {
  observations: SafetyObservation[];
  openActionsCount: number;
  onCreateObservation?: () => void;
}

const severityConfig = {
  high: { label: "cockpit-status-blocking" },
  medium: { label: "cockpit-status-at-risk" },
  low: { label: "cockpit-status-ok" },
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
    <div className="cockpit-card-secondary overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="cockpit-title flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          Safety
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[13px]"
          onClick={onCreateObservation}
          data-testid="button-create-observation"
        >
          <Plus className="h-3 w-3 mr-1" />
          Report
        </Button>
      </div>
      <div className="px-4 py-2 flex gap-4 cockpit-num">
        <div>
          <p className="cockpit-title">{observations.length}</p>
          <p className="cockpit-label">This Week</p>
        </div>
        <div>
          <p className="cockpit-title cockpit-status-at-risk">{openObservations.length}</p>
          <p className="cockpit-label">Open</p>
        </div>
        <div>
          <p className="cockpit-title cockpit-status-blocking">{openActionsCount}</p>
          <p className="cockpit-label">Actions</p>
        </div>
      </div>
      <div className="space-y-1 max-h-[160px] overflow-y-auto p-3">
        {observations.length === 0 ? (
          <div className="text-center py-6 cockpit-body text-muted-foreground">
            <Shield className="h-6 w-6 mx-auto mb-2 cockpit-status-ok" />
            <p>No observations this week.</p>
          </div>
        ) : (
          observations.slice(0, 5).map((obs) => {
            const config = severityConfig[obs.severity];
            return (
              <div
                key={obs.id}
                className="flex items-center gap-2 p-2 rounded border border-border"
                data-testid={`observation-item-${obs.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`cockpit-label ${config.label}`}>{obs.severity}</span>
                    {obs.status === "action_created" && (
                      <span className="cockpit-label text-muted-foreground">Action Created</span>
                    )}
                  </div>
                  <p className="cockpit-body font-medium truncate">{obs.title}</p>
                  <p className="cockpit-label truncate">
                    {obs.location || obs.stationName || "Unknown"} · {formatObservedDate(obs.observedAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
