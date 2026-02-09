import { Shield, Database, Factory, Zap } from "lucide-react";

const signals = [
  { icon: Shield, text: "Built for auditability" },
  { icon: Database, text: "RLS security model" },
  { icon: Factory, text: "Operationally grounded" },
  { icon: Zap, text: "Pilot-ready in weeks" },
];

export function ProofBar() {
  return (
    <section className="py-8 bg-white border-y border-black/5" aria-label="Trust signals">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-muted-foreground">
          {signals.map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-foreground/50" aria-hidden />
              <span>{text}</span>
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="text-foreground font-medium">Pilot targets:</span>
            <span>Reduce compliance surprises by 30–50% (pilot target)</span>
          </span>
        </div>
      </div>
    </section>
  );
}
