import { WarmSection } from "./WarmSection";
import { Grid3X3, FileCheck, TrendingUp, ScrollText } from "lucide-react";
import { StationLine, ChecklistLine, ShieldLine } from "./illustrations";

const modules = [
  {
    icon: Grid3X3,
    illu: StationLine,
    title: "Competence Matrix",
    benefit: "Who can do what, at which level—in one place.",
    bullets: ["Skills and levels mapped to stations and roles", "Eligibility and coverage derived from the matrix"],
  },
  {
    icon: FileCheck,
    illu: ChecklistLine,
    title: "Compliance",
    benefit: "Licenses, medicals, contracts—exposure and due actions in one view.",
    bullets: ["Catalog of requirements and employee compliance state", "Inbox for overdue and upcoming actions"],
  },
  {
    icon: TrendingUp,
    illu: StationLine,
    title: "Gap Engine & Readiness Index",
    benefit: "Tomorrow’s gaps and readiness, not yesterday’s reports.",
    bullets: ["Shift-level coverage and gap detection", "Readiness index for lines and stations", "Threshold-based alerts and decision support"],
  },
  {
    icon: ScrollText,
    illu: ShieldLine,
    title: "Audit Log & Decisions",
    benefit: "Every material decision logged and traceable.",
    bullets: ["Decision log for staffing and overrides", "Audit trail for compliance and competence changes"],
  },
];

export function CoreModules() {
  return (
    <WarmSection variant="white" className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Capabilities</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
          Four pillars for auditable competence and compliance
        </h2>

        <div className="mt-14 space-y-24">
          {modules.map((mod, i) => {
            const Illu = mod.illu;
            const isEven = i % 2 === 0;
            const collage = (
              <div className="flex justify-center">
                <div className="w-full max-w-sm">
                  <div className="rounded-lg bg-surface p-8 border border-border">
                    <div className="w-16 h-16 text-muted-foreground/50 flex items-center justify-center mb-4">
                      <Illu className="w-14 h-14" aria-hidden />
                    </div>
                    <div className="rounded-lg bg-background p-4 border border-border">
                      <p className="text-xs text-muted-foreground">{mod.title}</p>
                      <p className="mt-1 text-lg font-display font-normal text-foreground">94%</p>
                      <p className="text-xs text-muted-foreground mt-2">Readiness · 2 due</p>
                    </div>
                  </div>
                </div>
              </div>
            );
            const text = (
              <div>
                <h3 className="font-display text-xl font-normal text-foreground">{mod.title}</h3>
                <p className="mt-2 text-muted-foreground">{mod.benefit}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground" role="list">
                  {mod.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-[#1e3a5f] shrink-0">—</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
            return (
              <div key={mod.title} className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
                {isEven ? collage : text}
                {isEven ? text : collage}
              </div>
            );
          })}
        </div>
      </div>
    </WarmSection>
  );
}
