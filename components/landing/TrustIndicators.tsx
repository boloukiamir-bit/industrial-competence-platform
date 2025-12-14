import { Shield, Award, CheckCircle2 } from "lucide-react";

const logos = [
  { name: "Siemens", initial: "S" },
  { name: "Shell", initial: "SH" },
  { name: "Boeing", initial: "B" },
  { name: "Caterpillar", initial: "C" },
  { name: "General Electric", initial: "GE" },
];

export function TrustIndicators() {
  return (
    <section className="py-12 border-b border-border bg-muted/30" data-testid="section-trust">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-muted-foreground" data-testid="text-trust-heading">
            Trusted by leading industrial organizations worldwide
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 mb-10">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="w-20 h-12 flex items-center justify-center rounded-md bg-muted/50 text-muted-foreground font-semibold text-lg grayscale hover:grayscale-0 transition-all"
              data-testid={`logo-${logo.name.toLowerCase().replace(/\s+/g, "-")}`}
              title={logo.name}
            >
              {logo.initial}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-chart-3" />
            <span data-testid="text-badge-iso">ISO 27001 Certified</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="w-4 h-4 text-chart-4" />
            <span data-testid="text-badge-gdpr">GDPR Compliant</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span data-testid="text-badge-soc2">SOC 2 Type II</span>
          </div>
        </div>
      </div>
    </section>
  );
}
