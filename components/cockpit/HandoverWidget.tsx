"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRightLeft, 
  CircleDot, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Download
} from "lucide-react";
import type { HandoverItem } from "@/types/cockpit";

interface HandoverWidgetProps {
  openLoops: HandoverItem[];
  decisions: HandoverItem[];
  risks: HandoverItem[];
  onGenerateHandover: () => void;
}

const typeConfig = {
  open_loop: { icon: CircleDot, label: "Open", color: "text-orange-500" },
  decision: { icon: CheckCircle2, label: "Decision", color: "text-green-500" },
  risk: { icon: AlertTriangle, label: "Risk", color: "text-red-500" },
};

const severityStyles = {
  low: "bg-slate-100 dark:bg-slate-800",
  medium: "bg-orange-100 dark:bg-orange-900/30",
  high: "bg-red-100 dark:bg-red-900/30",
};

export function HandoverWidget({
  openLoops,
  decisions,
  risks,
  onGenerateHandover,
}: HandoverWidgetProps) {
  const totalItems = openLoops.length + decisions.length + risks.length;

  const renderSection = (title: string, items: HandoverItem[], type: 'open_loop' | 'decision' | 'risk') => {
    if (items.length === 0) return null;
    const config = typeConfig[type];
    const Icon = config.icon;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title} ({items.length})
          </span>
        </div>
        <div className="space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className={`p-2 rounded-md text-sm ${item.severity ? severityStyles[item.severity] : 'bg-muted/50'}`}
              data-testid={`handover-item-${item.id}`}
            >
              <p className="font-medium text-sm leading-tight">{item.title}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
              )}
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-xs text-muted-foreground pl-2">+{items.length - 3} more</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Shift Handover</h3>
              <p className="text-xs text-muted-foreground">{totalItems} items to hand over</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateHandover}
            data-testid="button-handover-generate"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Generate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalItems === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All clear for handover</p>
          </div>
        ) : (
          <>
            {renderSection("Open Loops", openLoops, "open_loop")}
            {renderSection("Decisions Made", decisions, "decision")}
            {renderSection("Risks for Next Shift", risks, "risk")}
          </>
        )}
      </CardContent>
    </Card>
  );
}
