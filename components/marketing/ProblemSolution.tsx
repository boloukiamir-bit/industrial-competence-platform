import { WarmSection } from "./WarmSection";
import { FileQuestion, LayoutGrid, CalendarClock, Database, GitBranch, Scale } from "lucide-react";
import { ChecklistLine, ShieldLine, FactoryOutline } from "./illustrations";

const pains = [
  {
    icon: FileQuestion,
    illu: ChecklistLine,
    title: "Competence not auditable",
    description: "Skills live in spreadsheets and tribal knowledge. Auditors and planners can’t rely on a single source of truth.",
  },
  {
    icon: LayoutGrid,
    illu: ShieldLine,
    title: "Compliance scattered",
    description: "Licenses, medicals, and contracts live in multiple systems. Exposure and due dates are hard to see.",
  },
  {
    icon: CalendarClock,
    illu: FactoryOutline,
    title: "Planning fragile",
    description: "Shift coverage and readiness break when people or requirements change. Gaps show up too late.",
  },
];

const principles = [
  { icon: Database, title: "Single source of truth", description: "One system of record for skills, stations, and requirements. Auditable and queryable." },
  { icon: GitBranch, title: "Skills → Stations logic", description: "Eligibility and coverage derived from skills and station demand. No ad-hoc lists." },
  { icon: Scale, title: "Audit-grade compliance", description: "Compliance exposure, actions, and decision log in one place. Built for auditors." },
];

export function ProblemSolution() {
  return (
    <WarmSection dotGrid>
      <div id="product" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Why BCLEDGE</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
          What breaks in factories — and how we fix it
        </h2>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {pains.map((p) => {
            const Illu = p.illu;
            return (
            <div
              key={p.title}
              className="rounded-lg bg-surface p-8 border border-border"
            >
              <div className="w-12 h-12 text-muted-foreground/60 flex items-center justify-center mb-4">
                <Illu className="w-10 h-10" aria-hidden />
              </div>
              <h3 className="font-display text-xl font-normal text-foreground">{p.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{p.description}</p>
            </div>
          );
          })}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {principles.map((p) => (
            <div key={p.title} className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
                <p.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </WarmSection>
  );
}
