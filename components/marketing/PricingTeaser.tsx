import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check } from "lucide-react";
import { WarmSection } from "./WarmSection";

const pilotIncludes = [
  "Competence matrix and compliance module",
  "Gap engine and readiness index",
  "Audit log and decision capture",
  "Dedicated onboarding and support",
];

const scaleIncludes = [
  "Everything in Pilot",
  "Multi-site and multi-org",
  "API and integrations",
  "SLA and dedicated success",
];

export function PricingTeaser() {
  return (
    <WarmSection dotGrid>
      <div id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
          Start with a pilot. Scale when you’re ready.
        </h2>
        <p className="mt-2 text-muted-foreground max-w-2xl">Contact us for details.</p>
        <div className="mt-12 grid md:grid-cols-2 gap-8 max-w-4xl">
          <Card className="rounded-lg border-border bg-surface overflow-hidden">
            <CardHeader className="pb-2">
              <h3 className="font-display text-xl font-normal text-foreground">Pilot</h3>
              <p className="text-sm text-muted-foreground mt-1">
                For teams ready to make competence auditable in weeks.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground" role="list">
                {pilotIncludes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full rounded-lg border-border" asChild>
                <Link href="#book-demo">Contact sales</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-border bg-surface overflow-hidden">
            <CardHeader className="pb-2">
              <h3 className="font-display text-xl font-normal text-foreground">Scale</h3>
              <p className="text-sm text-muted-foreground mt-1">
                For organizations running BCLEDGE across sites and teams.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground" role="list">
                {scaleIncludes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full rounded-lg border-border" asChild>
                <Link href="#book-demo">Contact sales</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </WarmSection>
  );
}
