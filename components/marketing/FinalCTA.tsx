import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WarmSection } from "./WarmSection";

export function FinalCTA() {
  return (
    <WarmSection dotGrid className="border-t border-black/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 id="final-cta-heading" className="font-display text-2xl md:text-4xl font-normal tracking-tight text-foreground">
          Make competence auditable.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Book a demo or join our pilot. Most pilots are live within weeks.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Button size="lg" className="marketing-accent border-0 rounded-xl" asChild>
            <Link href="#book-demo" id="book-demo">Book a demo</Link>
          </Button>
          <Button variant="outline" size="lg" className="rounded-xl border-black/10 hover:bg-white/80" asChild>
            <Link href="#join-pilot" id="join-pilot">Join pilot</Link>
          </Button>
        </div>
      </div>
    </WarmSection>
  );
}
