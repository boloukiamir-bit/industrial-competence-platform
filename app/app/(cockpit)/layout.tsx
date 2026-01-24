"use client";

import { ExecutionDecisionPanel } from "@/components/ExecutionDecisionPanel";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExecutionDecisionPanel />
      {children}
    </>
  );
}
