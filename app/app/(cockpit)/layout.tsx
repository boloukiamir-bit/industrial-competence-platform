"use client";

import { ExecutionDecisionPanel } from "@/components/ExecutionDecisionPanel";
import { OperationalReadinessBanner } from "@/components/cockpit/OperationalReadinessBanner";
import { CockpitFilterProvider } from "@/lib/CockpitFilterContext";
import { SessionHealthProvider } from "@/lib/SessionHealthContext";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SessionHealthProvider>
        <div className="mb-4 mx-4 sm:mx-8">
          <OperationalReadinessBanner />
        </div>
        <CockpitFilterProvider>
          <ExecutionDecisionPanel />
          {children}
        </CockpitFilterProvider>
      </SessionHealthProvider>
    </div>
  );
}
