"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Shield, FileWarning, ChevronRight } from "lucide-react";
import type { PriorityItem } from "@/types/cockpit";

interface PriorityFixesWidgetProps {
  items: PriorityItem[];
  onResolve: (item: PriorityItem) => void;
}

const typeConfig = {
  staffing: { icon: Users, label: "Staffing", color: "text-red-600 dark:text-red-400" },
  compliance: { icon: FileWarning, label: "Compliance", color: "text-orange-600 dark:text-orange-400" },
  safety: { icon: Shield, label: "Safety", color: "text-amber-600 dark:text-amber-400" },
};

export function PriorityFixesWidget({ items, onResolve }: PriorityFixesWidgetProps) {
  if (items.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-green-700 dark:text-green-300">All clear</p>
            <p className="text-sm text-muted-foreground">No critical issues right now</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/80 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">What to Fix Now</h2>
            <p className="text-xs text-muted-foreground">{items.length} priority issue{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 5).map((item) => {
          const config = typeConfig[item.type];
          const Icon = config.icon;
          
          return (
            <div
              key={item.id}
              className="group flex items-center justify-between p-3 rounded-lg bg-card border hover-elevate transition-all"
              data-testid={`priority-item-${item.id}`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`mt-0.5 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{item.title}</span>
                    {item.severity === 'critical' && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Critical</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.impact}</p>
                  {item.linkedEntity && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.linkedEntity.type === 'station' ? 'Station:' : 'Employee:'} {item.linkedEntity.name}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="ml-2 shrink-0 opacity-70 group-hover:opacity-100"
                onClick={() => onResolve(item)}
                data-testid={`button-resolve-${item.id}`}
              >
                Resolve
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
