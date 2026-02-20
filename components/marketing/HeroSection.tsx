import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroProductCollage } from "./HeroProductCollage";

export function HeroSection() {
  return (
    <section
      className="warm-bg warm-dot-grid pt-28 pb-24 md:pt-32 md:pb-28 lg:pt-36 lg:pb-32"
      aria-labelledby="hero-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr,1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              System of record
            </p>
            <h1
              id="hero-heading"
              className="mt-3 font-display text-3xl sm:text-4xl md:text-[2.75rem] lg:text-5xl font-normal tracking-tight text-foreground leading-[1.15] max-w-xl"
            >
              The system of record for industrial competence and compliance.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
              One auditable source of truth for skills, readiness, and compliance. Reduce risk with a decision log that stands up to audit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="marketing-accent border-0 rounded-lg" asChild>
                <Link href="#book-demo">Book a demo</Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-lg border-border hover:bg-surface" asChild>
                <Link href="#join-pilot">Join pilot</Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroProductCollage />
          </div>
        </div>
      </div>
    </section>
  );
}
