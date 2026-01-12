"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserX, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import type { StationStaffingCard } from "@/types/cockpit";

interface StaffingWidgetProps {
  staffingCards: StationStaffingCard[];
  onSuggestReplacement?: (stationId: string) => void;
}

const statusConfig = {
  green: {
    bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    icon: <UserX className="h-4 w-4 text-red-600" />,
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
};

export function StaffingWidget({ staffingCards, onSuggestReplacement }: StaffingWidgetProps) {
  const greenCount = staffingCards.filter(s => s.complianceStatus === "green").length;
  const yellowCount = staffingCards.filter(s => s.complianceStatus === "yellow").length;
  const redCount = staffingCards.filter(s => s.complianceStatus === "red").length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-blue-500" />
            Staffing Status
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
              {greenCount}
            </Badge>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
              {yellowCount}
            </Badge>
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
              {redCount}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {staffingCards.map((card) => {
            const config = statusConfig[card.complianceStatus];
            return (
              <div
                key={card.station.id}
                className={`p-3 rounded-lg border ${config.bg} transition-all`}
                data-testid={`station-card-${card.station.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={card.station.name}>
                      {card.station.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{card.station.line}</p>
                  </div>
                  {config.icon}
                </div>
                
                {card.employee ? (
                  <div className="mb-2">
                    <p className="text-sm font-medium truncate">{card.employee.name}</p>
                    {card.complianceIssues.length > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 truncate">
                        {card.complianceIssues[0].title}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-2">
                    <p className="text-sm text-muted-foreground italic">Unassigned</p>
                  </div>
                )}

                {card.complianceStatus === "red" && onSuggestReplacement && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7"
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
      </CardContent>
    </Card>
  );
}
