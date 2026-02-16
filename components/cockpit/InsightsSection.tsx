"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaffingWidget } from "@/components/cockpit/StaffingWidget";
import { ComplianceWidget } from "@/components/cockpit/ComplianceWidget";
import { SafetyWidget } from "@/components/cockpit/SafetyWidget";
import { HandoverWidget } from "@/components/cockpit/HandoverWidget";
import { ActionsWidget } from "@/components/cockpit/ActionsWidget";
import { PlanActualWidget } from "@/components/cockpit/PlanActualWidget";
import { PriorityFixesWidget } from "@/components/cockpit/PriorityFixesWidget";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import type {
  StationStaffingCard,
  ComplianceItem,
  SafetyObservation,
  HandoverItem,
  Action,
  PlanVsActual,
  PriorityItem,
} from "@/types/cockpit";

export type InsightsSectionProps = {
  defaultOpen?: boolean;
  staffingCards: StationStaffingCard[];
  onSuggestReplacement: (stationId: string) => void;
  complianceItems: ComplianceItem[];
  onCreateComplianceAction: (item: ComplianceItem) => void;
  safetyObservations: SafetyObservation[];
  openSafetyActionsCount: number;
  onCreateObservation: () => void;
  handoverData: { openLoops: HandoverItem[]; decisions: HandoverItem[]; risks: HandoverItem[] };
  onGenerateHandover: () => void;
  actions: Action[];
  onMarkActionDone: (actionId: string) => void;
  onActionClick: (action: Action) => void;
  summary: CockpitSummaryResponse | null;
  summaryLoading: boolean;
  summaryError: string | null;
  planVsActual: PlanVsActual[];
  priorityItems: PriorityItem[];
  onResolvePriority: (item: PriorityItem) => void;
  date: string;
  shiftType: string;
};

export function InsightsSection({
  defaultOpen = false,
  staffingCards,
  onSuggestReplacement,
  complianceItems,
  onCreateComplianceAction,
  safetyObservations,
  openSafetyActionsCount,
  onCreateObservation,
  handoverData,
  onGenerateHandover,
  actions,
  onMarkActionDone,
  onActionClick,
  summary,
  summaryLoading,
  summaryError,
  planVsActual,
  priorityItems,
  onResolvePriority,
  date,
  shiftType,
}: InsightsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-8">
      <CollapsibleTrigger
        className={cn(
          "inline-flex items-center gap-2 py-2 text-left cockpit-cc-heading text-muted-foreground hover:text-foreground"
        )}
        data-testid="insights-trigger"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        Insights
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Tabs defaultValue="staffing" className="mt-3">
          <TabsList className="mb-3 w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="staffing" className="text-xs">Staffing</TabsTrigger>
            <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs">Safety</TabsTrigger>
            <TabsTrigger value="handover" className="text-xs">Handover</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
          </TabsList>
          <TabsContent value="staffing" className="mt-0">
            <StaffingWidget
              staffingCards={staffingCards}
              onSuggestReplacement={onSuggestReplacement}
            />
          </TabsContent>
          <TabsContent value="compliance" className="mt-0">
            <ComplianceWidget
              items={complianceItems}
              onCreateAction={onCreateComplianceAction}
            />
          </TabsContent>
          <TabsContent value="safety" className="mt-0">
            <SafetyWidget
              observations={safetyObservations}
              openActionsCount={openSafetyActionsCount}
              onCreateObservation={onCreateObservation}
            />
          </TabsContent>
          <TabsContent value="handover" className="mt-0">
            <HandoverWidget
              openLoops={handoverData.openLoops}
              decisions={handoverData.decisions}
              risks={handoverData.risks}
              onGenerateHandover={onGenerateHandover}
            />
          </TabsContent>
          <TabsContent value="actions" className="mt-0 space-y-4">
            <PriorityFixesWidget
              items={priorityItems}
              onResolve={onResolvePriority}
              summary={summary ?? undefined}
              summaryLoading={summaryLoading}
              summaryError={summaryError}
              date={date}
              shiftType={shiftType}
            />
            <ActionsWidget
              actions={actions}
              onMarkDone={onMarkActionDone}
              onActionClick={onActionClick}
              summary={summary}
              summaryLoading={summaryLoading}
              summaryError={summaryError}
            />
            <PlanActualWidget data={planVsActual} />
          </TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}
