"use client";

import { CockpitFilterProvider } from "@/lib/CockpitFilterContext";
import { SessionHealthProvider } from "@/lib/SessionHealthContext";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SessionHealthProvider>
        <CockpitFilterProvider>
          {children}
        </CockpitFilterProvider>
      </SessionHealthProvider>
    </div>
  );
}
