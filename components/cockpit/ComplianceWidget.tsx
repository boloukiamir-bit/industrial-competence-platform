"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="cockpit-card-secondary overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="cockpit-title flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
          Compliance
        </h3>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-2">
          <TabsList className="grid w-full grid-cols-3 h-7 cockpit-label">
            <TabsTrigger value="all" className="text-[11px]" data-testid="tab-all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="expiring" className="text-[11px]" data-testid="tab-expiring">Expiring ({expiringCount})</TabsTrigger>
            <TabsTrigger value="overdue" className="text-[11px]" data-testid="tab-overdue">Overdue ({overdueCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="space-y-1 max-h-[220px] overflow-y-auto p-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-6 cockpit-body text-muted-foreground">
            <ShieldAlert className="h-6 w-6 mx-auto mb-2 cockpit-status-ok" />
            <p>No compliance issues in this category.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-2 p-2.5 rounded-sm border-l-[3px] ${
                item.status === "expired"
                  ? "border-l-[hsl(var(--ds-status-blocking-text))]"
                  : "border-l-[hsl(var(--ds-status-at-risk-text))]"
              }`}
              data-testid={`compliance-item-${item.id}`}
            >
              {item.status === "expired" ? (
                <AlertTriangle className="h-3.5 w-3.5 cockpit-status-blocking shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 cockpit-status-at-risk shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="cockpit-body font-medium truncate">{item.employeeName}</p>
                <p className="cockpit-label truncate">{item.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`cockpit-label cockpit-num ${item.status === "expired" ? "cockpit-status-blocking" : "cockpit-status-at-risk"}`}>
                  {formatExpiryDate(item.expiryDate)}
                </span>
                {onCreateAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => onCreateAction(item)}
                    title="Create renewal action"
                    data-testid={`button-action-${item.id}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
