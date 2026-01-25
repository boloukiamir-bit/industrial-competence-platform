"use client";

import { ExecutionDecisionPanel } from "@/components/ExecutionDecisionPanel";
import { CockpitFilterProvider } from "@/lib/CockpitFilterContext";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <CockpitFilterProvider>
      <ExecutionDecisionPanel />
      {children}
    </CockpitFilterProvider>
  );
}
