"use client";

import { Button } from "@/components/ui/button";
import { Users, UserX, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import type { StationStaffingCard } from "@/types/cockpit";

interface StaffingWidgetProps {
  staffingCards: StationStaffingCard[];
  onSuggestReplacement?: (stationId: string) => void;
}

const statusConfig = {
  green: {
    border: "border-l-[3px] border-l-[hsl(var(--ds-status-ok-text))]",
    icon: <CheckCircle className="h-3.5 w-3.5 text-[hsl(var(--ds-status-ok-text))]" />,
  },
  yellow: {
    border: "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]",
    icon: <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--ds-status-at-risk-text))]" />,
  },
  red: {
    border: "border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]",
    icon: <UserX className="h-3.5 w-3.5 text-[hsl(var(--ds-status-blocking-text))]" />,
  },
};

export function StaffingWidget({ staffingCards, onSuggestReplacement }: StaffingWidgetProps) {
  const greenCount = staffingCards.filter(s => s.complianceStatus === "green").length;
  const yellowCount = staffingCards.filter(s => s.complianceStatus === "yellow").length;
  const redCount = staffingCards.filter(s => s.complianceStatus === "red").length;

  return (
    <div className="cockpit-card-secondary overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="cockpit-title flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Staffing Status
        </h3>
        <div className="flex items-center gap-2 cockpit-label cockpit-num">
          <span className="cockpit-status-ok">{greenCount} OK</span>
          <span className="cockpit-status-at-risk">{yellowCount} At Risk</span>
          <span className="cockpit-status-blocking">{redCount} Blocking</span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {staffingCards.map((card) => {
            const config = statusConfig[card.complianceStatus];
            return (
              <div
                key={card.station.id}
                className={`p-2.5 rounded-sm ${config.border}`}
                data-testid={`station-card-${card.station.id}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="cockpit-body font-medium truncate" title={card.station.name}>
                      {card.station.name}
                    </p>
                    <p className="cockpit-label">{card.station.line}</p>
                  </div>
                  {config.icon}
                </div>
                
                {card.employee ? (
                  <div className="mb-1">
                    <p className="cockpit-body truncate">{card.employee.name}</p>
                    {card.complianceIssues.length > 0 && (
                      <p className="cockpit-label cockpit-status-blocking truncate">
                        {card.complianceIssues[0].title}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="cockpit-body text-muted-foreground">Unassigned</p>
                )}

                {card.complianceStatus === "red" && onSuggestReplacement && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-[13px] mt-1"
                    onClick={() => onSuggestReplacement(card.station.id)}
                    data-testid={`button-suggest-${card.station.id}`}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Suggest
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
