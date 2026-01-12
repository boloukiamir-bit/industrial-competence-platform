"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, AlertTriangle, Star, User } from "lucide-react";
import type { EmployeeSuggestion, Station } from "@/types/cockpit";

interface StaffingSuggestModalProps {
  station: Station | null;
  open: boolean;
  onClose: () => void;
  suggestions: EmployeeSuggestion[];
  onApply: (stationId: string, employeeId: string, employeeName: string) => void;
}

const availabilityStyles = {
  available: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  busy: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  off: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function StaffingSuggestModal({
  station,
  open,
  onClose,
  suggestions,
  onApply,
}: StaffingSuggestModalProps) {
  if (!station) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Suggest Replacement
          </DialogTitle>
          <DialogDescription>
            Top recommendations for <span className="font-medium">{station.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No suitable employees available</p>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <div
                key={suggestion.employee.id}
                className="group flex items-center justify-between p-3 rounded-lg border hover-elevate transition-all"
                data-testid={`suggestion-${suggestion.employee.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {suggestion.employee.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    {index === 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                        <Star className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{suggestion.employee.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${availabilityStyles[suggestion.availability]}`}>
                        {suggestion.availability}
                      </Badge>
                      {suggestion.complianceValid ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                          <Check className="h-3 w-3" /> Compliant
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" /> Issues
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Match</p>
                    <p className="text-sm font-semibold">{Math.round(suggestion.score)}%</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onApply(station.id, suggestion.employee.id, suggestion.employee.name)}
                    data-testid={`button-apply-suggestion-${suggestion.employee.id}`}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
