"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarmSection } from "./WarmSection";

const useCases = [
  {
    id: "hr-compliance",
    label: "HR / Compliance",
    outcomes: [
      "One place for competence and compliance state",
      "Audit-ready evidence and decision log",
      "Actions inbox for overdue and upcoming items",
    ],
    replaces: "Spreadsheets, ad-hoc checklists, and tribal knowledge for who is qualified and compliant.",
  },
  {
    id: "production-staffing",
    label: "Production / Staffing",
    outcomes: [
      "Shift-level coverage and gap visibility",
      "Readiness index for lines and stations",
      "Eligibility derived from skills and demand",
    ],
    replaces: "Manual lists, phone calls, and last-minute surprises when someone is missing or not qualified.",
  },
  {
    id: "management-risk",
    label: "Management / Risk",
    outcomes: [
      "Compliance exposure and readiness at a glance",
      "Traceable decisions for audits and reviews",
      "AI-assisted insights where applicable",
    ],
    replaces: "Scattered reports and gut feel. BCLEDGE gives a single source of truth for risk and readiness.",
  },
];

export function UseCases() {
  return (
    <WarmSection dotGrid>
      <div id="use-cases" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Use cases</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
          Built for HR, production, and management—one platform
        </h2>
        <Tabs defaultValue="hr-compliance" className="mt-12">
          <TabsList className="w-full sm:w-auto flex flex-wrap h-auto gap-1 p-1.5 bg-white/80 rounded-xl border border-black/5 shadow-sm">
            {useCases.map((uc) => (
              <TabsTrigger
                key={uc.id}
                value={uc.id}
                className="data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:border data-[state=active]:border-black/5 rounded-lg px-5 py-2.5 text-sm font-medium"
              >
                {uc.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {useCases.map((uc) => (
            <TabsContent
              key={uc.id}
              value={uc.id}
              className="mt-8 rounded-2xl bg-white p-8 md:p-10 border border-black/5 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)]"
            >
              <h3 className="font-display text-xl font-normal text-foreground">{uc.label}</h3>
              <p className="mt-3 text-muted-foreground">{uc.replaces}</p>
              <ul className="mt-6 space-y-2" role="list">
                {uc.outcomes.map((o) => (
                  <li key={o} className="flex gap-2 text-sm">
                    <span className="text-[#1e3a5f] shrink-0">—</span>
                    <span className="text-foreground">{o}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </WarmSection>
  );
}
