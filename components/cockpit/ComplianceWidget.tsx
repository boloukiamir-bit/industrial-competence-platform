"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Clock, AlertTriangle, Plus } from "lucide-react";
import type { ComplianceItem } from "@/types/cockpit";

interface ComplianceWidgetProps {
  items: ComplianceItem[];
  onCreateAction?: (item: ComplianceItem) => void;
}

function formatExpiryDate(expiryDate?: string): string {
  if (!expiryDate) return "No date";
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  return `${diffDays}d left`;
}

export function ComplianceWidget({ items, onCreateAction }: ComplianceWidgetProps) {
  const [filter, setFilter] = useState<"all" | "expiring" | "overdue">("all");

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "expiring") return item.status === "expiring_soon";
    if (filter === "overdue") return item.status === "expired";
    return true;
  });

  const expiringCount = items.filter(i => i.status === "expiring_soon").length;
  const overdueCount = items.filter(i => i.status === "expired").length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Compliance Radar
          </CardTitle>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-2">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
              All ({items.length})
            </TabsTrigger>
            <TabsTrigger value="expiring" className="text-xs" data-testid="tab-expiring">
              Expiring ({expiringCount})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs" data-testid="tab-overdue">
              Overdue ({overdueCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">No compliance issues in this category.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-3 p-3 rounded-lg border transition-all ${
                item.status === "expired"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              }`}
              data-testid={`compliance-item-${item.id}`}
            >
              {item.status === "expired" ? (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.employeeName}</p>
                <p className="text-xs text-muted-foreground truncate">{item.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    item.status === "expired"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                  }`}
                >
                  {formatExpiryDate(item.expiryDate)}
                </Badge>
                {onCreateAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => onCreateAction(item)}
                    title="Create renewal action"
                    data-testid={`button-action-${item.id}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
