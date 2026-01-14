"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cog, User, Zap, Plus } from "lucide-react";
import type { MachineWithData, ShiftType } from "@/types/lineOverview";

interface MachineCardProps {
  data: MachineWithData;
  viewMode: "day" | "week";
  onClick: () => void;
  onSuggest: () => void;
  onImportDemand?: () => void;
}

const statusStyles = {
  ok: {
    border: "border-green-200 dark:border-green-800",
    bg: "bg-green-50 dark:bg-green-900/20",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    text: "OK",
  },
  partial: {
    border: "border-yellow-200 dark:border-yellow-800",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
    text: "Partial",
  },
  gap: {
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50 dark:bg-red-900/20",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    text: "Gap",
  },
  over: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    text: "Over-assigned",
  },
  no_demand: {
    border: "border-muted",
    bg: "",
    badge: "bg-muted text-muted-foreground",
    text: "No demand",
  },
};

export function MachineCard({ data, viewMode, onClick, onSuggest, onImportDemand }: MachineCardProps) {
  const { machine, requiredHours, assignedHours, gap, overAssigned, status, assignedPeople } = data;
  const style = statusStyles[status];
  const hasDemand = requiredHours > 0;

  return (
    <Card
      className={`cursor-pointer transition-all hover-elevate ${style.border} ${hasDemand ? style.bg : ""}`}
      onClick={onClick}
      data-testid={`machine-card-${machine.machineCode}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-muted">
              <Cog className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">{machine.machineName}</h4>
              <p className="text-xs text-muted-foreground">{machine.machineCode}</p>
            </div>
          </div>
          {hasDemand && (
            <Badge variant="secondary" className={`text-xs ${style.badge}`}>
              {style.text}
            </Badge>
          )}
        </div>

        {hasDemand ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div>
                <p className="text-lg font-bold">{requiredHours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Required</p>
              </div>
              <div>
                <p className="text-lg font-bold">{assignedHours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div>
                {overAssigned > 0 ? (
                  <>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      +{overAssigned.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">Over</p>
                  </>
                ) : (
                  <>
                    <p className={`text-lg font-bold ${gap > 0 ? "text-destructive" : "text-green-600"}`}>
                      {gap > 0 ? gap.toFixed(1) : "0.0"}
                    </p>
                    <p className="text-xs text-muted-foreground">Gap</p>
                  </>
                )}
              </div>
            </div>

            {viewMode === "day" && assignedPeople.length > 0 && (
              <div className="mb-3 space-y-1">
                {assignedPeople.slice(0, 3).map((person, idx) => (
                  <div
                    key={`${person.employeeCode}-${idx}`}
                    className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium truncate max-w-[100px]">
                        {person.employeeName}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {person.startTime.slice(0, 5)}–{person.endTime.slice(0, 5)}
                    </span>
                  </div>
                ))}
                {assignedPeople.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{assignedPeople.length - 3} more
                  </p>
                )}
              </div>
            )}

            {viewMode === "day" && assignedPeople.length === 0 && (
              <div className="mb-3 py-2 text-center text-xs text-muted-foreground bg-muted/30 rounded">
                No assignments yet
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                data-testid={`button-assign-${machine.machineCode}`}
              >
                Assign
              </Button>
              {gap > 0 && (
                <Button
                  size="sm"
                  className="flex-1 h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggest();
                  }}
                  data-testid={`button-suggest-${machine.machineCode}`}
                >
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  Suggest
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">No demand scheduled</p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onImportDemand?.();
              }}
              data-testid={`button-import-demand-${machine.machineCode}`}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add demand
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
