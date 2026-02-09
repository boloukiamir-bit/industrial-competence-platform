"use client";

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
  open_loop: { icon: CircleDot, label: "Open", status: "cockpit-status-at-risk" },
  decision: { icon: CheckCircle2, label: "Decision", status: "cockpit-status-ok" },
  risk: { icon: AlertTriangle, label: "Risk", status: "cockpit-status-blocking" },
};

const severityStyles = {
  low: "border-l-[3px] border-l-[hsl(var(--ds-status-ok-text))]",
  medium: "border-l-[3px] border-l-[hsl(var(--ds-status-at-risk-text))]",
  high: "border-l-[3px] border-l-[hsl(var(--ds-status-blocking-text))]",
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
          <Icon className={`h-3.5 w-3.5 ${config.status}`} />
          <span className="cockpit-label">
            {title} ({items.length})
          </span>
        </div>
        <div className="space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className={`p-2 rounded-sm cockpit-body ${item.severity ? severityStyles[item.severity] : "border-l-[3px] border-l-border"}`}
              data-testid={`handover-item-${item.id}`}
            >
              <p className="cockpit-body font-medium leading-tight">{item.title}</p>
              {item.description && (
                <p className="cockpit-label mt-0.5 line-clamp-1">{item.description}</p>
              )}
            </div>
          ))}
          {items.length > 3 && (
            <p className="cockpit-label pl-2 cockpit-num">+{items.length - 3} more</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cockpit-card-secondary overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <h3 className="cockpit-title">Shift Handover</h3>
            <p className="cockpit-label mt-0.5">{totalItems} items to hand over</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[13px]"
          onClick={onGenerateHandover}
          data-testid="button-handover-generate"
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Generate
        </Button>
      </div>
      <div className="space-y-4 p-4">
        {totalItems === 0 ? (
          <div className="text-center py-6 cockpit-body text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 cockpit-status-ok mx-auto mb-2" />
            <p>All clear for handover</p>
          </div>
        ) : (
          <>
            {renderSection("Open Loops", openLoops, "open_loop")}
            {renderSection("Decisions Made", decisions, "decision")}
            {renderSection("Risks for Next Shift", risks, "risk")}
          </>
        )}
      </div>
    </div>
  );
}
